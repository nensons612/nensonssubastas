import React, { useState, useEffect } from 'react';

const API_URL = 'http://127.0.0.1:5001/nensonssubastas-35510/us-central1/api/create-auction';

export default function AuctionForm() {
  const [formData, setFormData] = useState({
    vendedor: '',
    precioInicial: '',
    montoMinimo: '',
    titulo: '',
  });

  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewUrls, setPreviewUrls] = useState([]);
  const [responseMessage, setResponseMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create preview URLs when selectedFiles changes
  useEffect(() => {
    if (selectedFiles.length === 0) {
      setPreviewUrls([]);
      return;
    }
    const urls = selectedFiles.map(file => URL.createObjectURL(file));
    setPreviewUrls(urls);

    // Cleanup the object URLs when component unmounts or files change
    return () => urls.forEach(url => URL.revokeObjectURL(url));
  }, [selectedFiles]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => [...prev, ...files]);
  };

  const removeImage = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setResponseMessage('');

    // Validate precioInicial is integer
    if (!/^\d+$/.test(formData.precioInicial)) {
      setResponseMessage('❌ Precio Inicial debe ser un número entero.');
      setSubmitting(false);
      return;
    }

    try {
      const data = new FormData();

      data.append('Nombre del Vendedor', formData.vendedor);
      data.append('Precio Inicial', formData.precioInicial);
      data.append('Monto Minimo de Oferta', formData.montoMinimo);
      data.append('Titulo de la Subasta', formData.titulo);

      selectedFiles.forEach((file, i) => {
        data.append('images', file, file.name);
      });

      const res = await fetch(API_URL, {
        method: 'POST',
        body: data,
      });

      const result = await res.json();

      if (res.ok && result.success) {
        setResponseMessage(`✅ Auction created! Article ID: ${result.article.id}`);
        setFormData({
          vendedor: '',
          precioInicial: '',
          montoMinimo: '5 Pesos',
          titulo: '',
        });
        setSelectedFiles([]);
      } else {
        setResponseMessage(`❌ Error: ${result.message || 'Unknown error'}`);
      }
    } catch (err) {
      setResponseMessage(`❌ Network error: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Publica tu SUBASTA</h2>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label style={styles.label}>
          Nombre del Vendedor:
          <input
            type="text"
            name="vendedor"
            value={formData.vendedor}
            onChange={handleChange}
            disabled={submitting}
            placeholder="Nombre del Vendedor"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Precio Inicial:
          <input
            type="number"
            name="precioInicial"
            value={formData.precioInicial}
            onChange={handleChange}
            disabled={submitting}
            placeholder="Precio Inicial"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Monto Minimo de Oferta:
          <select
            name="montoMinimo"
            value={formData.montoMinimo}
            onChange={handleChange}
            disabled={submitting}
            style={{ ...styles.input, paddingRight: 0 }}
          >
            {['5 Pesos', '10 Pesos', '50 Pesos', 'Oferta Libre'].map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Titulo de la Subasta:
          <input
            type="text"
            name="titulo"
            value={formData.titulo}
            onChange={handleChange}
            disabled={submitting}
            placeholder="Titulo de la Subasta"
            required
            style={styles.input}
          />
        </label>

        <label style={styles.label}>
          Imagenes:
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={submitting}
            style={{ marginTop: 6 }}
          />
        </label>

        <div style={styles.imagePreviewContainer}>
          {previewUrls.map((url, i) => (
            <div key={i} style={styles.imageWrapper}>
              <img src={url} alt={`preview-${i}`} style={styles.image} />
              <button
                type="button"
                onClick={() => removeImage(i)}
                disabled={submitting}
                style={styles.removeButton}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={submitting ? {...styles.submitButton, ...styles.submitButtonDisabled} : styles.submitButton}
        >
          {submitting ? 'Creating Auction...' : 'Submit Auction'}
        </button>
      </form>

      {responseMessage && (
        <p
          style={
            responseMessage.startsWith('✅')
              ? styles.successText
              : styles.errorText
          }
        >
          {responseMessage}
        </p>
      )}

      <p style={{ marginTop: 20, fontStyle: 'italic', fontSize: 12 }}>
        * The first uploaded image will be used as the Shopify article preview image automatically.
      </p>
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 480,
    margin: '0 auto',
    padding: 20,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
    marginTop: 15,
    marginBottom: 6,
    display: 'flex',
    flexDirection: 'column',
  },
  input: {
    padding: 10,
    fontSize: 16,
    borderRadius: 8,
    border: '1.5px solid #ddd',
    outline: 'none',
  },
  imagePreviewContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    marginTop: 15,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
    width: 80,
    height: 80,
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid #ccc',
  },
  image: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    border: 'none',
    borderRadius: '50%',
    width: 20,
    height: 20,
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    lineHeight: '18px',
    cursor: 'pointer',
  },
  submitButton: {
    marginTop: 20,
    backgroundColor: '#2980b9',
    color: 'white',
    border: 'none',
    borderRadius: 10,
    padding: '14px 0',
    fontWeight: '800',
    fontSize: 18,
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  submitButtonDisabled: {
    backgroundColor: '#7f8c8d',
    cursor: 'not-allowed',
  },
  successText: {
    marginTop: 20,
    fontWeight: '700',
    fontSize: 16,
    color: 'green',
    textAlign: 'center',
  },
  errorText: {
    marginTop: 20,
    fontWeight: '700',
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
  },
};

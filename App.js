import React, { useState } from 'react';
import { 
  View, Text, TextInput, Button, Image, ScrollView, TouchableOpacity, StyleSheet, Platform 
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const API_URL = 'https://api-j2254pyida-uc.a.run.app';

export default function App() {
  const [formData, setFormData] = useState({
    'Nombre del Vendedor': '',
    'Precio Inicial': '',
    'Monto Minimo de Oferta': '5 Pesos',
    'Titulo de la Subasta': '',
  });

  const [selectedImages, setSelectedImages] = useState([]);
  const [responseMessage, setResponseMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (key, value) => {
    setFormData(prev => ({ ...prev, [key]: value }));
  };

const pickImage = async () => {
  const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permissionResult.granted) {
    alert("Permission to access camera roll is required!");
    return;
  }

     let pickerResult = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    quality: 1,
  });

   if (!pickerResult.canceled && pickerResult.assets && pickerResult.assets.length > 0) {
    // ✅ This now adds ALL selected images, not just one
    setSelectedImages(prev => [...prev, ...pickerResult.assets]);
  }
};

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
  setSubmitting(true);
  setResponseMessage('');

  // Validate Precio Inicial is integer number
  if (!/^\d+$/.test(formData['Precio Inicial'])) {
    setResponseMessage('❌ Precio Inicial debe ser un número entero.');
    setSubmitting(false);
    return;
  }

  try {
    const data = new FormData();

    Object.entries(formData).forEach(([key, val]) => {
      data.append(key, val);
    });

    selectedImages.forEach((img, i) => {
      let uri = img.uri;
      if (Platform.OS === 'android' && !uri.startsWith('file://')) {
        uri = 'file://' + uri;
      }

      const uriParts = uri.split('.');
      const fileType = uriParts[uriParts.length - 1].toLowerCase();

      let mimeType = 'image/jpeg'; // default
      if (fileType === 'png') mimeType = 'image/png';
      else if (fileType === 'jpg' || fileType === 'jpeg') mimeType = 'image/jpeg';
      else if (fileType === 'heic') mimeType = 'image/heic';

      data.append('images', {
        uri,
        name: `photo_${i}.${fileType}`,
        type: mimeType,
      });
    });

    const res = await fetch(`${API_URL}/create-auction`, {
      method: 'POST',
      body: data,
    });

    const result = await res.json();

    if (res.ok && result.success) {
      setResponseMessage(`✅ Auction created! Article ID: ${result.article.id}`);
      setFormData({
        'Nombre del Vendedor': '',
        'Precio Inicial': '',
        'Monto Minimo de Oferta': '5 Pesos',
        'Titulo de la Subasta': '',
      });
      setSelectedImages([]);
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Publica tu SUBASTA</Text>

      <Text style={styles.label}>Nombre:</Text>
      <TextInput
        style={styles.input}
        value={formData['Nombre del Vendedor']}
        onChangeText={(text) => handleChange('Nombre del Vendedor', text)}
        editable={!submitting}
        placeholder="Nombre del Vendedor"
      />

      <Text style={styles.label}>Precio Inicial:</Text>
      <TextInput
        style={styles.input}
        value={formData['Precio Inicial']}
        onChangeText={(text) => handleChange('Precio Inicial', text)}
        editable={!submitting}
        keyboardType="numeric"
        placeholder="Precio Inicial"
      />

      <Text style={styles.label}>Monto Minimo de Oferta:</Text>
      <View style={styles.optionsContainer}>
        {['5 Pesos', '10 Pesos', '50 Pesos', 'Oferta Libre'].map(option => (
          <TouchableOpacity
            key={option}
            style={[
              styles.optionButton,
              formData['Monto Minimo de Oferta'] === option && styles.optionSelected
            ]}
            disabled={submitting}
            onPress={() => handleChange('Monto Minimo de Oferta', option)}
          >
            <Text style={[
              styles.optionText,
              formData['Monto Minimo de Oferta'] === option && styles.optionTextSelected
            ]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Titulo de la Subasta:</Text>
      <TextInput
        style={styles.input}
        value={formData['Titulo de la Subasta']}
        onChangeText={(text) => handleChange('Titulo de la Subasta', text)}
        editable={!submitting}
        placeholder="Titulo de la Subasta"
      />

      <Text style={styles.label}>Imagenes:</Text>
      <Button title="Pick Image" onPress={pickImage} disabled={submitting} />

      <View style={styles.imagePreviewContainer}>
        {selectedImages.map((img, i) => (
          <View key={i} style={styles.imageWrapper}>
            <Image source={{ uri: img.uri }} style={styles.image} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(i)}
              disabled={submitting}
            >
              <Text style={styles.removeButtonText}>×</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        onPress={handleSubmit}
        disabled={submitting}
        style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
      >
        <Text style={styles.submitButtonText}>
          {submitting ? 'Creating Auction...' : 'Submit Auction'}
        </Text>
      </TouchableOpacity>

      {responseMessage ? (
        <Text style={[
          styles.responseText, 
          responseMessage.startsWith('✅') ? styles.successText : styles.errorText
        ]}>
          {responseMessage}
        </Text>
      ) : null}

      {/* NOTE: Backend uses the first uploaded image as the Shopify article preview image automatically. */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: 'stretch',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontWeight: '700',
    fontSize: 16,
    marginTop: 10,
    marginBottom: 5,
  },
  input: {
    borderWidth: 1.8,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 10,
  },
  optionButton: {
    borderWidth: 1,
    borderColor: '#2980b9',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  optionSelected: {
    backgroundColor: '#2980b9',
  },
  optionText: {
    color: '#2980b9',
    fontWeight: '700',
  },
  optionTextSelected: {
    color: 'white',
  },
  imagePreviewContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 10,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
    width: 80,
    height: 80,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#ccc',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  removeButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 50,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  removeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    lineHeight: 18,
  },
  submitButton: {
    backgroundColor: '#2980b9',
    borderRadius: 10,
    paddingVertical: 14,
    marginTop: 10,
  },
  submitButtonDisabled: {
    backgroundColor: '#7f8c8d',
  },
  submitButtonText: {
    color: 'white',
    fontWeight: '800',
    fontSize: 18,
    textAlign: 'center',
  },
  responseText: {
    marginTop: 20,
    fontWeight: '700',
    fontSize: 16,
    textAlign: 'center',
  },
  successText: {
    color: 'green',
  },
  errorText: {
    color: 'red',
  },
});

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Button,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
  StatusBar,
  Linking,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as ImagePicker from 'expo-image-picker';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { supabase } from './supabase-client';

const STORAGE_KEY = '@billager_cars';
const { width, height } = Dimensions.get('window');
const Stack = createStackNavigator();

export default function App() {
  const [screen, setScreen] = useState('home');
  const [cars, setCars] = useState([]);
  const [selectedCar, setSelectedCar] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCars = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('cars')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error loading cars:', error);
        Alert.alert('Error', 'Could not load cars: ' + error.message);
      } else {
        setCars(data || []);
      }
    } catch (error) {
      console.error('Error loading cars:', error);
      Alert.alert('Error', 'Could not load cars');
    }
  }, [user]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('@user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (error) {
        console.error('Error loading user:', error);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadCars();
    }
  }, [user, loadCars]);



  const addCar = useCallback(async (carData) => {
    try {
      const { data, error } = await supabase
        .from('cars')
        .insert([{
          user_id: user.id,
          brand: carData.brand,
          model: carData.model,
          year: carData.year,
          km: carData.km,
          price: carData.price,
          images: carData.images || [],
        }])
        .select();
      
      if (error) {
        Alert.alert('Error', 'Could not save car: ' + error.message);
      } else {
        await loadCars();
        setScreen('home');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not save car');
    }
  }, [user, loadCars]);

  const updateCar = useCallback(async (carId, carData) => {
    try {
      const { error } = await supabase
        .from('cars')
        .update({
          brand: carData.brand,
          model: carData.model,
          year: carData.year,
          km: carData.km,
          price: carData.price,
          images: carData.images || [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', carId);
      
      if (error) {
        Alert.alert('Error', 'Could not update car: ' + error.message);
      } else {
        await loadCars();
        setScreen('home');
      }
    } catch (error) {
      Alert.alert('Error', 'Could not update car');
    }
  }, [loadCars]);

  const deleteCar = useCallback(async (carId) => {
    Alert.alert(
      'Delete Car',
      'Are you sure you want to delete this car?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cars')
                .delete()
                .eq('id', carId);
              
              if (error) {
                Alert.alert('Error', 'Could not delete car: ' + error.message);
              } else {
                await loadCars();
                setScreen('home');
                setSelectedCar(null);
              }
            } catch (error) {
              Alert.alert('Error', 'Could not delete car');
            }
          },
        },
      ]
    );
  }, [loadCars]);

  const filteredAndSortedCars = useMemo(() => {
    let filtered = cars.filter((car) => {
      const query = searchQuery.toLowerCase();
      return (
        car.brand.toLowerCase().includes(query) ||
        car.model.toLowerCase().includes(query) ||
        car.year.toString().includes(query)
      );
    });

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return parseInt(b.price || 0) - parseInt(a.price || 0);
        case 'km':
          return parseInt(a.km || 0) - parseInt(b.km || 0);
        case 'date':
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });
  }, [cars, searchQuery, sortBy]);

  const handleCarPress = useCallback((car) => {
    setSelectedCar(car);
    setScreen('details');
  }, []);

  const AuthScreen = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [phone, setPhone] = useState('');
    const [authLoading, setAuthLoading] = useState(false);

    const handleSignUp = async () => {
      if (!email || !password || !username || !phone) {
        Alert.alert('Error', 'Please fill all fields');
        return;
      }
      if (password.length < 6) {
        Alert.alert('Error', 'Password must be at least 6 characters');
        return;
      }
      
      setAuthLoading(true);
      try {
        // Check if email already exists
        const { data: existingUsers } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.trim());
        
        if (existingUsers && existingUsers.length > 0) {
          Alert.alert('Error', 'Email already registered. Please sign in.');
          setIsLogin(true);
          setAuthLoading(false);
          return;
        }

        // Insert new user
        const { data, error } = await supabase
          .from('users')
          .insert([{
            username: username.trim(),
            email: email.trim(),
            password: password,
            phone: parseInt(phone),
          }])
          .select();
        
        if (error) {
          Alert.alert('Sign Up Error', error.message);
        } else if (data && data.length > 0) {
          Alert.alert('Success', 'Account created! You can now sign in.');
          setIsLogin(true);
          setUsername('');
          setPhone('');
        }
      } catch (error) {
        Alert.alert('Error', error.message);
      } finally {
        setAuthLoading(false);
      }
    };

    const handleSignIn = async () => {
      if (!email || !password) {
        Alert.alert('Error', 'Please enter email and password');
        return;
      }
      
      setAuthLoading(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('email', email.trim())
          .eq('password', password)
          .single();
        
        if (error || !data) {
          Alert.alert('Login Error', 'Invalid email or password');
        } else {
          // Save user to AsyncStorage
          await AsyncStorage.setItem('@user', JSON.stringify(data));
          setUser(data);
        }
      } catch (error) {
        Alert.alert('Error', 'Login failed');
      } finally {
        setAuthLoading(false);
      }
    };

    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.authContainer}
        >
          <View style={styles.authContent}>
            <Text style={styles.authTitle}>Billager</Text>
            <Text style={styles.authSubtitle}>
              {isLogin ? 'Sign in to your account' : 'Create a new account'}
            </Text>
            
            {!isLogin && (
              <>
                <TextInput
                  style={styles.authInput}
                  placeholder="Username"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="words"
                  placeholderTextColor="#999"
                />
                <TextInput
                  style={styles.authInput}
                  placeholder="Phone"
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="numeric"
                  placeholderTextColor="#999"
                />
              </>
            )}
            
            <TextInput
              style={styles.authInput}
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholderTextColor="#999"
            />
            <TextInput
              style={styles.authInput}
              placeholder="Password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              placeholderTextColor="#999"
            />
            
            <TouchableOpacity 
              style={[styles.authButton, authLoading && styles.authButtonDisabled]}
              onPress={isLogin ? handleSignIn : handleSignUp}
              disabled={authLoading}
            >
              <Text style={styles.authButtonText}>
                {authLoading ? 'Loading...' : (isLogin ? 'Sign In' : 'Sign Up')}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.authSwitchButton}
              onPress={() => setIsLogin(!isLogin)}
            >
              <Text style={styles.authSwitchText}>
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  };

  const handleSignOut = async () => {
    try {
      await AsyncStorage.removeItem('@user');
      setUser(null);
      setCars([]);
    } catch (error) {
      Alert.alert('Error', 'Could not sign out');
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (screen === 'add') {
    return <AddCarScreen onBack={() => setScreen('home')} onSave={addCar} />;
  }

  if (screen === 'edit' && selectedCar) {
    return (
      <EditCarScreen
        car={selectedCar}
        onBack={() => setScreen('details')}
        onSave={(data) => updateCar(selectedCar.id, data)}
      />
    );
  }

  if (screen === 'details' && selectedCar) {
    return (
      <CarDetailsScreen
        car={selectedCar}
        onBack={() => {
          setScreen('home');
          setSelectedCar(null);
        }}
        onEdit={() => setScreen('edit')}
        onDelete={() => deleteCar(selectedCar.id)}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <Header cars={filteredAndSortedCars} />
      <SearchAndSort 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />
      <CarList 
        cars={filteredAndSortedCars}
        onCarPress={handleCarPress}
        onAddCar={() => setScreen('add')}
      />
      <TouchableOpacity 
        style={styles.signOutButton}
        onPress={handleSignOut}
      >
        <Text style={styles.signOutButtonText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const CarCard = React.memo(({ car, onPress }) => {
  return (
    <TouchableOpacity style={styles.carCard} onPress={onPress}>
      {car.images && car.images.length > 0 ? (
        <Image source={{ uri: car.images[0] }} style={styles.carImage} />
      ) : (
        <View style={styles.noImage}>
          <Text style={styles.noImageText}>No image</Text>
        </View>
      )}
      <View style={styles.carInfo}>
        <Text style={styles.carTitle}>{car.brand} {car.model}</Text>
        <Text style={styles.carYear}>Year: {car.year}</Text>
        <Text style={styles.carKm}>{parseInt(car.km || 0).toLocaleString('nb-NO')} km</Text>
        <Text style={styles.carPrice}>{parseInt(car.price || 0).toLocaleString('nb-NO')} kr</Text>
      </View>
    </TouchableOpacity>
  );
});

const Header = React.memo(({ cars }) => {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>🚗 Billager</Text>
      <Text style={styles.headerSubtitle}>{cars.length} cars for sale</Text>
    </View>
  );
});

const SearchAndSort = React.memo(({ searchQuery, setSearchQuery, sortBy, setSortBy }) => {
  return (
    <View style={styles.searchContainer}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search brand, model or year..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#999"
      />
      <View style={styles.sortButtons}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
          onPress={() => setSortBy('date')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'date' && styles.sortButtonTextActive]}>Newest</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'price' && styles.sortButtonActive]}
          onPress={() => setSortBy('price')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'price' && styles.sortButtonTextActive]}>Price</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'km' && styles.sortButtonActive]}
          onPress={() => setSortBy('km')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'km' && styles.sortButtonTextActive]}>Mileage</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
});

function CarList({ cars, onCarPress, onAddCar }) {
  return (
    <View style={{ flex: 1 }}>
      {cars.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>No cars found</Text>
          <Text style={styles.emptySubtext}>Add your first car</Text>
        </View>
      ) : (
        <FlatList
          data={cars}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CarCard car={item} onPress={() => onCarPress(item)} />
          )
          }
          contentContainerStyle={styles.listContent}
          scrollEnabled={true}
        />
      )}
      <TouchableOpacity style={styles.fab} onPress={onAddCar}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function AddCarScreen({ onBack, onSave }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);
  
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    year: '',
    km: '',
    price: '',
    description: '',
    images: [],
    ownerName: '',
    ownerPhone: '',
    ownerEmail: '',
  });

  const [errors, setErrors] = useState({});

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.brand.trim()) newErrors.brand = 'Brand is required';
    if (!formData.model.trim()) newErrors.model = 'Model is required';
    if (!formData.year.trim()) newErrors.year = 'Year is required';
    if (!formData.km.trim()) newErrors.km = 'Mileage is required';
    if (!formData.price.trim()) newErrors.price = 'Price is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Name is required';
    if (!formData.ownerPhone.trim()) newErrors.ownerPhone = 'Phone is required';
    
    if (formData.year && (parseInt(formData.year) < 1900 || parseInt(formData.year) > new Date().getFullYear() + 1)) {
      newErrors.year = 'Invalid year';
    }
    
    if (formData.km && parseInt(formData.km) < 0) {
      newErrors.km = 'Invalid mileage';
    }
    
    if (formData.price && parseInt(formData.price) < 0) {
      newErrors.price = 'Invalid price';
    }

    if (formData.ownerEmail && !formData.ownerEmail.includes('@')) {
      newErrors.ownerEmail = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      onSave(formData);
    } else {
      Alert.alert('Error', 'Please fill all required fields');
    }
  }, [validateForm, onSave, formData]);

  const takePicture = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        
        updateField('images', [...formData.images, photo.uri]);
        setShowCamera(false);
      } catch (error) {
        Alert.alert('Error', 'Could not take picture');
      }
    }
  }, [formData.images, updateField]);

  const openCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera access is required');
        return;
      }
    }
    setShowCamera(true);
  }, [cameraPermission, requestCameraPermission]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library access is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        updateField('images', [...formData.images, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image');
    }
  }, [formData.images, updateField]);

  const removeImage = useCallback((index) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    updateField('images', newImages);
  }, [formData.images, updateField]);

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.cameraButtons}>
            <TouchableOpacity
              style={styles.cameraBackButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.cameraButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Add Car</Text>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {formData.images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addImageButtons}>
                <TouchableOpacity style={styles.addImageButton} onPress={openCamera}>
                  <Text style={styles.addImageText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <Text style={styles.addImageText}>🖼️ Choose Photos</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <Text style={styles.sectionTitle}>Car Details</Text>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Brand *</Text>
            <TextInput
              style={[styles.input, errors.brand && styles.inputError]}
              value={formData.brand}
              onChangeText={(text) => updateField('brand', text)}
              placeholder="e.g. Toyota, BMW, Volvo"
              placeholderTextColor="#ccc"
            />
            {errors.brand && <Text style={styles.errorText}>{errors.brand}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Model *</Text>
            <TextInput
              style={[styles.input, errors.model && styles.inputError]}
              value={formData.model}
              onChangeText={(text) => updateField('model', text)}
              placeholder="e.g. Corolla, X5, V70"
              placeholderTextColor="#ccc"
            />
            {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Year *</Text>
            <TextInput
              style={[styles.input, errors.year && styles.inputError]}
              value={formData.year}
              onChangeText={(text) => updateField('year', text)}
              placeholder="e.g. 2020"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.year && <Text style={styles.errorText}>{errors.year}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Mileage *</Text>
            <TextInput
              style={[styles.input, errors.km && styles.inputError]}
              value={formData.km}
              onChangeText={(text) => updateField('km', text)}
              placeholder="e.g. 50000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.km && <Text style={styles.errorText}>{errors.km}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Price (kr) *</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              value={formData.price}
              onChangeText={(text) => updateField('price', text)}
              placeholder="e.g. 250000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => updateField('description', text)}
              placeholder="Describe the car, equipment, condition..."
              placeholderTextColor="#ccc"
              multiline
              numberOfLines={4}
            />
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput
              style={[styles.input, errors.ownerName && styles.inputError]}
              value={formData.ownerName}
              onChangeText={(text) => updateField('ownerName', text)}
              placeholder="Your name"
              placeholderTextColor="#ccc"
            />
            {errors.ownerName && <Text style={styles.errorText}>{errors.ownerName}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Phone *</Text>
            <TextInput
              style={[styles.input, errors.ownerPhone && styles.inputError]}
              value={formData.ownerPhone}
              onChangeText={(text) => updateField('ownerPhone', text)}
              placeholder="Your phone number"
              placeholderTextColor="#ccc"
              keyboardType="phone-pad"
            />
            {errors.ownerPhone && <Text style={styles.errorText}>{errors.ownerPhone}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={[styles.input, errors.ownerEmail && styles.inputError]}
              value={formData.ownerEmail}
              onChangeText={(text) => updateField('ownerEmail', text)}
              placeholder="Your email"
              placeholderTextColor="#ccc"
              keyboardType="email-address"
            />
            {errors.ownerEmail && <Text style={styles.errorText}>{errors.ownerEmail}</Text>}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Car</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function EditCarScreen({ car, onBack, onSave }) {
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showCamera, setShowCamera] = useState(false);
  const cameraRef = useRef(null);
  
  const [formData, setFormData] = useState({
    brand: car.brand,
    model: car.model,
    year: car.year,
    km: car.km,
    price: car.price,
    description: car.description || '',
    images: car.images || [],
    ownerName: car.ownerName || '',
    ownerPhone: car.ownerPhone || '',
    ownerEmail: car.ownerEmail || '',
  });

  const [errors, setErrors] = useState({});

  const updateField = useCallback((field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: null }));
  }, []);

  const validateForm = useCallback(() => {
    const newErrors = {};
    
    if (!formData.brand.trim()) newErrors.brand = 'Brand is required';
    if (!formData.model.trim()) newErrors.model = 'Model is required';
    if (!formData.year.trim()) newErrors.year = 'Year is required';
    if (!formData.km.trim()) newErrors.km = 'Mileage is required';
    if (!formData.price.trim()) newErrors.price = 'Price is required';
    if (!formData.ownerName.trim()) newErrors.ownerName = 'Name is required';
    if (!formData.ownerPhone.trim()) newErrors.ownerPhone = 'Phone is required';
    
    if (formData.year && (parseInt(formData.year) < 1900 || parseInt(formData.year) > new Date().getFullYear() + 1)) {
      newErrors.year = 'Invalid year';
    }
    
    if (formData.km && parseInt(formData.km) < 0) {
      newErrors.km = 'Invalid mileage';
    }
    
    if (formData.price && parseInt(formData.price) < 0) {
      newErrors.price = 'Invalid price';
    }

    if (formData.ownerEmail && !formData.ownerEmail.includes('@')) {
      newErrors.ownerEmail = 'Invalid email address';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleSave = useCallback(() => {
    if (validateForm()) {
      onSave(formData);
    } else {
      Alert.alert('Error', 'Please fill all required fields');
    }
  }, [validateForm, onSave, formData]);

  const takePicture = useCallback(async () => {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
        });
        updateField('images', [...formData.images, photo.uri]);
        setShowCamera(false);
      } catch (error) {
        Alert.alert('Error', 'Could not take picture');
      }
    }
  }, [formData.images, updateField]);

  const openCamera = useCallback(async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Denied', 'Camera access is required');
        return;
      }
    }
    setShowCamera(true);
  }, [cameraPermission, requestCameraPermission]);

  const pickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Photo library access is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets) {
        const newImages = result.assets.map(asset => asset.uri);
        updateField('images', [...formData.images, ...newImages]);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not pick image');
    }
  }, [formData.images, updateField]);

  const removeImage = useCallback((index) => {
    const newImages = formData.images.filter((_, i) => i !== index);
    updateField('images', newImages);
  }, [formData.images, updateField]);

  if (showCamera) {
    return (
      <View style={styles.container}>
        <CameraView style={styles.camera} ref={cameraRef} facing="back">
          <View style={styles.cameraButtons}>
            <TouchableOpacity
              style={styles.cameraBackButton}
              onPress={() => setShowCamera(false)}
            >
              <Text style={styles.cameraButtonText}>Close</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={takePicture}
            >
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Car</Text>
        <View style={{ width: 80 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
          
          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imageScroll}>
              {formData.images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewContainer}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Text style={styles.removeImageText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
              <View style={styles.addImageButtons}>
                <TouchableOpacity style={styles.addImageButton} onPress={openCamera}>
                  <Text style={styles.addImageText}>📷 Take Photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <Text style={styles.addImageText}>🖼️ Choose Photos</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          <Text style={styles.sectionTitle}>Car Details</Text>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Brand *</Text>
            <TextInput
              style={[styles.input, errors.brand && styles.inputError]}
              value={formData.brand}
              onChangeText={(text) => updateField('brand', text)}
              placeholder="e.g. Toyota, BMW, Volvo"
              placeholderTextColor="#ccc"
            />
            {errors.brand && <Text style={styles.errorText}>{errors.brand}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Model *</Text>
            <TextInput
              style={[styles.input, errors.model && styles.inputError]}
              value={formData.model}
              onChangeText={(text) => updateField('model', text)}
              placeholder="e.g. Corolla, X5, V70"
              placeholderTextColor="#ccc"
            />
            {errors.model && <Text style={styles.errorText}>{errors.model}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Year *</Text>
            <TextInput
              style={[styles.input, errors.year && styles.inputError]}
              value={formData.year}
              onChangeText={(text) => updateField('year', text)}
              placeholder="e.g. 2020"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.year && <Text style={styles.errorText}>{errors.year}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Mileage *</Text>
            <TextInput
              style={[styles.input, errors.km && styles.inputError]}
              value={formData.km}
              onChangeText={(text) => updateField('km', text)}
              placeholder="e.g. 50000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.km && <Text style={styles.errorText}>{errors.km}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Price (kr) *</Text>
            <TextInput
              style={[styles.input, errors.price && styles.inputError]}
              value={formData.price}
              onChangeText={(text) => updateField('price', text)}
              placeholder="e.g. 250000"
              placeholderTextColor="#ccc"
              keyboardType="number-pad"
            />
            {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={formData.description}
              onChangeText={(text) => updateField('description', text)}
              placeholder="Describe the car, equipment, condition..."
              placeholderTextColor="#ccc"
              multiline
              numberOfLines={4}
            />
          </View>

          <Text style={styles.sectionTitle}>Contact Information</Text>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Name *</Text>
            <TextInput
              style={[styles.input, errors.ownerName && styles.inputError]}
              value={formData.ownerName}
              onChangeText={(text) => updateField('ownerName', text)}
              placeholder="Your name"
              placeholderTextColor="#ccc"
            />
            {errors.ownerName && <Text style={styles.errorText}>{errors.ownerName}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Phone *</Text>
            <TextInput
              style={[styles.input, errors.ownerPhone && styles.inputError]}
              value={formData.ownerPhone}
              onChangeText={(text) => updateField('ownerPhone', text)}
              placeholder="Your phone number"
              placeholderTextColor="#ccc"
              keyboardType="phone-pad"
            />
            {errors.ownerPhone && <Text style={styles.errorText}>{errors.ownerPhone}</Text>}
          </View>

          <View style={styles.formSection}>
            <Text style={styles.formLabel}>Email</Text>
            <TextInput
              style={[styles.input, errors.ownerEmail && styles.inputError]}
              value={formData.ownerEmail}
              onChangeText={(text) => updateField('ownerEmail', text)}
              placeholder="Your email"
              placeholderTextColor="#ccc"
              keyboardType="email-address"
            />
            {errors.ownerEmail && <Text style={styles.errorText}>{errors.ownerEmail}</Text>}
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          <View style={{ height: 20 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CarDetailsScreen({ car, onBack, onEdit, onDelete }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const handleScroll = useCallback((e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setCurrentImageIndex(index);
  }, []);

  const handleCallOwner = () => {
    if (car.ownerPhone) {
      Linking.openURL(`tel:${car.ownerPhone}`).catch(() => {
        Alert.alert('Error', 'Could not make call');
      });
    }
  };

  const handleEmailOwner = () => {
    if (car.ownerEmail) {
      Linking.openURL(`mailto:${car.ownerEmail}`).catch(() => {
        Alert.alert('Error', 'Could not open email');
      });
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Car Details</Text>
        <View style={{ width: 80 }} />
      </View>

      <ScrollView style={styles.detailsContainer}>
        {car.images && car.images.length > 0 ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={handleScroll}
              scrollEventThrottle={16}
            >
              {car.images.map((uri, index) => (
                <Image
                  key={index}
                  source={{ uri }}
                  style={styles.detailImage}
                />
              ))}
            </ScrollView>
            {car.images.length > 1 && (
              <View style={styles.pagination}>
                {car.images.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.paginationDot,
                      index === currentImageIndex && styles.paginationDotActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noDetailImage}>
            <Text style={styles.noImageText}>No images</Text>
          </View>
        )}

        <View style={styles.detailsContent}>
          <Text style={styles.detailTitle}>{car.brand} {car.model}</Text>
          
          <View style={styles.detailRow}>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Year</Text>
              <Text style={styles.detailValue}>{car.year}</Text>
            </View>
            <View style={styles.detailItem}>
              <Text style={styles.detailLabel}>Mileage</Text>
              <Text style={styles.detailValue}>{parseInt(car.km || 0).toLocaleString('nb-NO')} km</Text>
            </View>
          </View>

          <View style={styles.priceContainer}>
            <Text style={styles.priceLabel}>Price</Text>
            <Text style={styles.priceValue}>{parseInt(car.price || 0).toLocaleString('nb-NO')} kr</Text>
          </View>

          {car.description && (
            <View style={styles.descriptionContainer}>
              <Text style={styles.descriptionLabel}>Description</Text>
              <Text style={styles.descriptionText}>{car.description}</Text>
            </View>
          )}

          <View style={styles.contactContainer}>
            <Text style={styles.descriptionLabel}>Seller Information</Text>
            
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>Name:</Text>
              <Text style={styles.contactValue}>{car.ownerName}</Text>
            </View>
            
            <View style={styles.contactItem}>
              <Text style={styles.contactLabel}>Phone:</Text>
              <TouchableOpacity onPress={handleCallOwner}>
                <Text style={styles.contactValueLink}>{car.ownerPhone}</Text>
              </TouchableOpacity>
            </View>

            {car.ownerEmail && (
              <View style={styles.contactItem}>
                <Text style={styles.contactLabel}>Email:</Text>
                <TouchableOpacity onPress={handleEmailOwner}>
                  <Text style={styles.contactValueLink}>{car.ownerEmail}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.metaInfo}>
            <Text style={styles.metaText}>
              Posted: {new Date(car.createdAt).toLocaleDateString('nb-NO')}
            </Text>
            {car.updatedAt !== car.createdAt && (
              <Text style={styles.metaText}>
                Updated: {new Date(car.updatedAt).toLocaleDateString('nb-NO')}
              </Text>
            )}
          </View>

          <View style={styles.contactButtonsRow}>
            <TouchableOpacity style={styles.callButton} onPress={handleCallOwner}>
              <Text style={styles.callButtonText}>📞 Call</Text>
            </TouchableOpacity>
            {car.ownerEmail && (
              <TouchableOpacity style={styles.emailButton} onPress={handleEmailOwner}>
                <Text style={styles.emailButtonText}>✉️ Email</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.editButton} onPress={onEdit}>
              <Text style={styles.editButtonText}>✏️ Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.deleteButton} onPress={onDelete}>
              <Text style={styles.deleteButtonText}>🗑️ Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  searchContainer: {
    backgroundColor: '#fff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 8,
    color: '#333',
  },
  sortButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 12,
    paddingBottom: 80,
  },
  carCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
  },
  carImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
  },
  noImage: {
    width: '100%',
    height: 200,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noImageText: {
    color: '#999',
    fontSize: 16,
  },
  carInfo: {
    padding: 16,
  },
  carTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  carYear: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  carKm: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  carPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#007AFF',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    color: '#999',
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    marginTop: 8,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
  },
  fabText: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '300',
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  formContent: {
    padding: 16,
    paddingBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginTop: 20,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  formSection: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  inputError: {
    borderColor: '#FF3B30',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 12,
    marginTop: 4,
    fontWeight: '500',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  imageScroll: {
    marginTop: 8,
  },
  imagePreviewContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  removeImageText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  addImageButton: {
    width: 120,
    height: 56,
    borderRadius: 8,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    marginBottom: 8,
  },
  addImageText: {
    color: '#007AFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  addImageButtons: {
    flexDirection: 'column',
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 16,
    elevation: 3,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  camera: {
    flex: 1,
  },
  cameraButtons: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 20,
  },
  cameraBackButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
  },
  cameraButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
  },
  detailsContainer: {
    flex: 1,
  },
  detailImage: {
    width: width,
    height: 300,
    backgroundColor: '#f0f0f0',
  },
  noDetailImage: {
    width: width,
    height: 300,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d0d0d0',
    marginHorizontal: 4,
  },
  paginationDotActive: {
    backgroundColor: '#007AFF',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  detailsContent: {
    backgroundColor: '#fff',
    padding: 20,
  },
  detailTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginBottom: 20,
  },
  detailRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 16,
  },
  detailItem: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  detailValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  priceContainer: {
    backgroundColor: '#f0f8ff',
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  priceLabel: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 4,
    fontWeight: '600',
  },
  priceValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#007AFF',
  },
  descriptionContainer: {
    marginBottom: 20,
  },
  descriptionLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  descriptionText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  contactContainer: {
    backgroundColor: '#f8f8f8',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  contactItem: {
    marginBottom: 12,
  },
  contactLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '600',
    marginBottom: 4,
  },
  contactValue: {
    fontSize: 15,
    color: '#333',
    fontWeight: '500',
  },
  contactValueLink: {
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  contactButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#34C759',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  callButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emailButton: {
    flex: 1,
    backgroundColor: '#FF9500',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#FF9500',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  emailButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  metaInfo: {
    marginBottom: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  metaText: {
    fontSize: 13,
    color: '#999',
    marginBottom: 4,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#FF3B30',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  filterMenu: {
    marginBottom: 16,
  },
  authContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  authContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  authTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
    color: '#333',
  },
  authSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    color: '#666',
  },
  authInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  authButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    elevation: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  authButtonDisabled: {
    backgroundColor: '#ccc',
  },
  authButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  authSwitchButton: {
    marginTop: 16,
    alignItems: 'center',
  },
  authSwitchText: {
    color: '#007AFF',
    fontSize: 14,
  },
  loadingText: {
    fontSize: 18,
    color: '#666',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
    padding: 12,
    margin: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  signOutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

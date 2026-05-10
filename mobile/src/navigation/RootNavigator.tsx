import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisteredWorkshopsScreen from '../screens/student/RegisteredWorkshopsScreen';
import WorkshopSelectionScreen from '../screens/staff/WorkshopSelectionScreen';
import QRScannerScreen from '../screens/staff/QRScannerScreen';
import { ActivityIndicator, View } from 'react-native';

const Stack = createNativeStackNavigator();

export default function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          user.role === 'staff' || user.role === 'admin' ? (
            <>
              <Stack.Screen name="StaffHome" component={WorkshopSelectionScreen} />
              <Stack.Screen name="QRScanner" component={QRScannerScreen} />
            </>
          ) : (
            <Stack.Screen name="StudentHome" component={RegisteredWorkshopsScreen} />
          )
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

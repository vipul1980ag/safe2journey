import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider }   from './src/context/AuthContext';
import { SafetyProvider } from './src/context/SafetyContext';

import HomeScreen        from './src/screens/HomeScreen';
import LoginScreen       from './src/screens/LoginScreen';
import PlanScreen        from './src/screens/PlanScreen';
import ResultsScreen     from './src/screens/ResultsScreen';
import TrackingScreen    from './src/screens/TrackingScreen';
import MapScreen         from './src/screens/MapScreen';
import HistoryScreen     from './src/screens/HistoryScreen';
import SafetySetupScreen from './src/screens/SafetySetupScreen';
import AIScreen          from './src/screens/AIScreen';

const Stack = createNativeStackNavigator();

const HEADER = {
  headerStyle: { backgroundColor: '#1565C0' },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <SafetyProvider>
          <NavigationContainer>
            <Stack.Navigator initialRouteName="Login" screenOptions={HEADER}>
              <Stack.Screen name="Login"       component={LoginScreen}       options={{ headerShown: false }} />
              <Stack.Screen name="Home"        component={HomeScreen}        options={{ title: 'Safe2Journey', headerLeft: () => null }} />
              <Stack.Screen name="Plan"        component={PlanScreen}        options={{ title: 'Plan Journey' }} />
              <Stack.Screen name="Results"     component={ResultsScreen}     options={{ title: 'Route Options' }} />
              <Stack.Screen name="Tracking"    component={TrackingScreen}    options={{ title: 'Track Journey' }} />
              <Stack.Screen name="Map"         component={MapScreen}         options={{ title: 'Route Map' }} />
              <Stack.Screen name="History"     component={HistoryScreen}     options={{ title: 'Journey History' }} />
              <Stack.Screen name="SafetySetup" component={SafetySetupScreen} options={{ title: 'Safety Setup' }} />
              <Stack.Screen name="AI"          component={AIScreen}          options={{ title: '🤖 AI Assistant' }} />
            </Stack.Navigator>
          </NavigationContainer>
        </SafetyProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

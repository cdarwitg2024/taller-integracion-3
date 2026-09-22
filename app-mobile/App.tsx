import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RegisterScreen } from './src/screens/RegisterScreen';

function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <RegisterScreen />
    </SafeAreaProvider>
  );
}

export default App;
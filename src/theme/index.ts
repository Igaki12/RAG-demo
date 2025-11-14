import { extendTheme, ThemeConfig } from '@chakra-ui/react';

const config: ThemeConfig = {
  initialColorMode: 'light',
  useSystemColorMode: false
};

const theme = extendTheme({
  config,
  fonts: {
    heading: '"Noto Sans JP", system-ui, sans-serif',
    body: '"Noto Sans JP", system-ui, sans-serif'
  },
  styles: {
    global: {
      body: {
        backgroundColor: 'gray.50',
        color: 'gray.800'
      }
    }
  }
});

export default theme;

import { Button, Typography, Stack } from '@mui/material';

function App() {
  return (
    <Stack spacing={2} sx={{ padding: 4 }}>
      <Typography variant="h3">
        CoffeeFaster
      </Typography>

      <Typography>
        Frontend Desktop
      </Typography>

      <Button variant="contained">
        Probar MUI
      </Button>
    </Stack>
  );
}

export default App;
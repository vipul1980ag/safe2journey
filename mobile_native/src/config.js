// Server configuration
// Override BASE_URL via the SAFE2JOURNEY_API env var when building,
// or edit this file for local development.
//
// Common values:
//   Android emulator  → http://10.0.2.2:3001/api
//   iOS simulator     → http://localhost:3001/api
//   Physical device   → http://<your-machine-local-ip>:3001/api
//   Production        → https://your-domain.com/api

const BASE_URL =
  process.env.SAFE2JOURNEY_API ||
  'https://safe2journey.onrender.com/api';

export const SERVER_ROOT =
  process.env.SAFE2JOURNEY_ROOT ||
  'https://safe2journey.onrender.com';

export default BASE_URL;

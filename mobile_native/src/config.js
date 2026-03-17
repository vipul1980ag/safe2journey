// Server configuration
// Override BASE_URL via the SAFE2JOURNEY_API env var when building,
// or edit this file for local development.
//
// Common values:
//   Android emulator  → http://10.0.2.2:3001/api
//   iOS simulator     → http://localhost:3001/api
//   Physical device   → http://<your-machine-local-ip>:3001/api
//   Production        → https://your-domain.com/api

const DEV_SERVER_IP = '192.168.178.60'; // change to your machine's local IP

const BASE_URL =
  process.env.SAFE2JOURNEY_API ||
  `http://${DEV_SERVER_IP}:3001/api`;

export const SERVER_ROOT =
  process.env.SAFE2JOURNEY_ROOT ||
  `http://${DEV_SERVER_IP}:3001`;

export default BASE_URL;

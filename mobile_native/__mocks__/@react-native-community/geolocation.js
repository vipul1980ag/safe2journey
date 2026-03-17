const Geolocation = {
  getCurrentPosition: jest.fn((success) =>
    success({ coords: { latitude: 28.6139, longitude: 77.209, speed: 0, heading: 0, accuracy: 5 } })
  ),
  watchPosition: jest.fn(() => 1),
  clearWatch: jest.fn(),
  stopObserving: jest.fn(),
  requestAuthorization: jest.fn(),
  setRNConfiguration: jest.fn(),
  addListener: jest.fn(),
};

export default Geolocation;

const db = require('../db/database');
const { fetchNearbyTransit } = require('./overpass');

const MODE_SPEEDS_KMH = { bus: 20, metro: 40, walking: 5, taxi: 30, auto: 25, car_bike: 35, tram: 18, train: 80, ferry: 25, air: 700 };

/** Currency symbol and code per region */
function regionCurrency(region) {
  switch (region) {
    case 'europe':              return { symbol: '€',   code: 'EUR' };
    case 'americas':            return { symbol: '$',   code: 'USD' };
    case 'oceania':             return { symbol: 'A$',  code: 'AUD' };
    case 'east_asia':           return { symbol: '¥',   code: 'JPY' };
    case 'middle_east':         return { symbol: 'AED', code: 'AED' };
    case 'africa':              return { symbol: 'KSh', code: 'KES' };
    case 'southeast_asia':      return { symbol: '฿',   code: 'THB' };
    case 'russia_central_asia': return { symbol: '₽',   code: 'RUB' };
    case 'south_asia':
    default:                    return { symbol: '₹',   code: 'INR' };
  }
}

// Keep for backward-compat export
function regionalFareMultiplier(region) { return 1; }

/**
 * Realistic local-currency fare estimates per region.
 * All amounts are in the local currency (€ for Europe, $ for Americas, etc.)
 * Short-distance trips use practical minimums (flag-fall + per-km).
 */
function cost(mode, distKm, region = 'south_asia') {
  const d = distKm;
  switch (region) {

    // ── Europe (€ EUR) ──────────────────────────────────────────────────────
    case 'europe': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(2.0, 1.5 + d * 0.12) * 10) / 10;
      case 'metro':
      case 'tram':     return d <= 30 ? 3.3 : Math.round((3.3 + (d - 30) * 0.08) * 10) / 10;
      case 'auto':     return Math.round((3.0 + d * 1.8) * 10) / 10;
      case 'taxi':     return Math.round((3.5 + d * 2.2) * 10) / 10;
      case 'car_bike': return Math.round(d * 0.35 * 10) / 10;
      case 'train':    return d <= 50  ? Math.round(Math.max(5,  4  + d * 0.22) * 10) / 10
                            : d <= 300 ? Math.round(Math.max(15, 8  + d * 0.18) * 10) / 10
                            : d <= 800 ? Math.round(Math.max(40, 15 + d * 0.14) * 10) / 10
                            :            Math.round(Math.max(80, 20 + d * 0.11) * 10) / 10;
      case 'ferry':    return Math.round(Math.max(8, 5 + d * 0.25) * 10) / 10;
      case 'air':      return Math.max(80, Math.round(60 + d * 0.12));
      default:         return Math.round(d * 1.5 * 10) / 10;
    }

    // ── Americas ($ USD) ────────────────────────────────────────────────────
    case 'americas': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(1.5, 1.25 + d * 0.10) * 10) / 10;
      case 'metro':
      case 'tram':     return d <= 30 ? 2.75 : Math.round((2.75 + (d - 30) * 0.07) * 10) / 10;
      case 'auto':     return Math.round((3.0 + d * 2.0) * 10) / 10;
      case 'taxi':     return Math.round((2.5 + d * 2.5) * 10) / 10;
      case 'car_bike': return Math.round(d * 0.18 * 10) / 10;
      case 'train':    return d <= 50  ? Math.round(Math.max(5,  4  + d * 0.20) * 10) / 10
                            : d <= 300 ? Math.round(Math.max(15, 10 + d * 0.18) * 10) / 10
                            : d <= 800 ? Math.round(Math.max(40, 20 + d * 0.15) * 10) / 10
                            :            Math.round(Math.max(80, 30 + d * 0.12) * 10) / 10;
      case 'ferry':    return Math.round(Math.max(10, 8 + d * 0.30) * 10) / 10;
      case 'air':      return Math.max(100, Math.round(80 + d * 0.15));
      default:         return Math.round(d * 2.0 * 10) / 10;
    }

    // ── Oceania (A$ AUD) ────────────────────────────────────────────────────
    case 'oceania': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(3.0, 2.0 + d * 0.15) * 10) / 10;
      case 'metro':
      case 'tram':     return d <= 30 ? 4.6 : Math.round((4.6 + (d - 30) * 0.10) * 10) / 10;
      case 'taxi':
      case 'auto':     return Math.round((4.2 + d * 2.5) * 10) / 10;
      case 'car_bike': return Math.round(d * 0.28 * 10) / 10;
      case 'train':    return d <= 50  ? Math.round(Math.max(4,  3  + d * 0.18) * 10) / 10
                            : d <= 300 ? Math.round(Math.max(12, 8  + d * 0.16) * 10) / 10
                            :            Math.round(Math.max(35, 15 + d * 0.13) * 10) / 10;
      case 'ferry':    return Math.round(Math.max(8, 6 + d * 0.25) * 10) / 10;
      case 'air':      return Math.max(120, Math.round(90 + d * 0.20));
      default:         return Math.round(d * 2.0 * 10) / 10;
    }

    // ── East Asia (¥ JPY) ────────────────────────────────────────────────────
    case 'east_asia': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(220, 180 + d * 10));
      case 'metro':
      case 'tram':     return d <= 3  ? 180
                            : d <= 10 ? 200 + Math.round(d * 15)
                            : d <= 25 ? 300 + Math.round(d * 12)
                            :           Math.round(400 + d * 10);
      case 'auto':
      case 'taxi':     return Math.round(500 + d * 90);
      case 'car_bike': return Math.round(d * 25);
      case 'train':    return d <= 50  ? Math.round(Math.max(200,  150 + d * 16))
                            : d <= 300 ? Math.round(Math.max(900,  300 + d * 22))
                            :            Math.round(Math.max(5000, 1000 + d * 20));
      case 'ferry':    return Math.round(Math.max(500, 400 + d * 30));
      case 'air':      return Math.max(8000, Math.round(5000 + d * 12));
      default:         return Math.round(d * 80);
    }

    // ── Middle East (AED) ────────────────────────────────────────────────────
    case 'middle_east': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(2, 1.5 + d * 0.08) * 10) / 10;
      case 'metro':
      case 'tram':     return d <= 20 ? 5 : Math.round((5 + (d - 20) * 0.12) * 10) / 10;
      case 'auto':
      case 'taxi':     return Math.round((5 + d * 2.2) * 10) / 10;
      case 'car_bike': return Math.round(d * 0.30 * 10) / 10;
      case 'train':    return d <= 100 ? Math.round(Math.max(5,  3  + d * 0.12) * 10) / 10
                            :            Math.round(Math.max(15, 10 + d * 0.10) * 10) / 10;
      case 'ferry':    return Math.round(Math.max(10, 8 + d * 0.20) * 10) / 10;
      case 'air':      return Math.max(150, Math.round(100 + d * 0.18));
      default:         return Math.round(d * 2.0 * 10) / 10;
    }

    // ── Africa (KSh KES) ────────────────────────────────────────────────────
    case 'africa': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(30, 20 + d * 5));
      case 'metro':
      case 'tram':     return Math.round(Math.max(50, 40 + d * 4));
      case 'auto':
      case 'taxi':     return Math.round(Math.max(200, 150 + d * 45));
      case 'car_bike': return Math.round(d * 12);
      case 'train':    return d <= 100 ? Math.round(Math.max(200, 100 + d * 8))
                            :            Math.round(Math.max(800, 300 + d * 6));
      case 'ferry':    return Math.round(Math.max(300, 200 + d * 20));
      case 'air':      return Math.max(8000, Math.round(5000 + d * 15));
      default:         return Math.round(d * 30);
    }

    // ── Southeast Asia (฿ THB) ───────────────────────────────────────────────
    case 'southeast_asia': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(15, 12 + d * 1.5));
      case 'metro':
      case 'tram':     return d <= 5  ? 25
                            : d <= 15 ? 35 + Math.round(d * 2)
                            :           Math.round(50 + d * 1.8);
      case 'auto':     return Math.round(Math.max(40, 35 + d * 8));
      case 'taxi':     return Math.round(Math.max(50, 35 + d * 10));
      case 'car_bike': return Math.round(d * 4);
      case 'train':    return d <= 100 ? Math.round(Math.max(30,  20 + d * 2))
                            : d <= 500 ? Math.round(Math.max(150, 50 + d * 1.5))
                            :            Math.round(Math.max(400, 100 + d * 1.2));
      case 'ferry':    return Math.round(Math.max(80, 60 + d * 5));
      case 'air':      return Math.max(1200, Math.round(800 + d * 3));
      default:         return Math.round(d * 10);
    }

    // ── Russia / Central Asia (₽ RUB) ────────────────────────────────────────
    case 'russia_central_asia': switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(40, 30 + d * 3));
      case 'metro':
      case 'tram':     return Math.round(Math.max(60, 45 + d * 3));
      case 'auto':
      case 'taxi':     return Math.round(Math.max(200, 150 + d * 25));
      case 'car_bike': return Math.round(d * 8);
      case 'train':    return d <= 100 ? Math.round(Math.max(200, 100 + d * 10))
                            : d <= 500 ? Math.round(Math.max(800, 200 + d * 8))
                            :            Math.round(Math.max(2000, 500 + d * 6));
      case 'ferry':    return Math.round(Math.max(300, 200 + d * 15));
      case 'air':      return Math.max(5000, Math.round(3000 + d * 8));
      default:         return Math.round(d * 20);
    }

    // ── South Asia default (₹ INR) ───────────────────────────────────────────
    default: switch (mode) {
      case 'walking':  return 0;
      case 'bus':      return Math.round(Math.max(10, 10 + d * 1.5));
      case 'metro':
      case 'tram':     return d <= 2  ? 10
                            : d <= 5  ? 20
                            : d <= 12 ? 30
                            : d <= 21 ? 40
                            : d <= 32 ? 50 : 60;
      case 'auto':     return Math.round(Math.max(30, 30 + d * 12));
      case 'taxi':     return Math.round(Math.max(60, 50 + d * 14));
      case 'car_bike': return Math.round(d * 6);
      case 'train':    return d <= 50  ? Math.round(Math.max(50,  50  + d * 1.8))
                            : d <= 300 ? Math.round(Math.max(130, 80  + d * 2.2))
                            : d <= 800 ? Math.round(Math.max(380, 100 + d * 2.8))
                            :            Math.round(Math.max(750, 150 + d * 3.2));
      case 'ferry':    return Math.round(Math.max(50, 40 + d * 3));
      case 'air':      return Math.max(2000, Math.round(1500 + d * 4));
      default:         return Math.round(d * 10);
    }
  }
}

/**
 * Detect broad region from coordinates to adapt transport modes locally.
 * Returns one of: 'south_asia' | 'southeast_asia' | 'europe' | 'americas' | 'oceania' | 'east_asia' | 'middle_east' | 'africa' | 'other'
 */
function detectRegion(lat, lng) {
  if (lat >= 34 && lat <= 72 && lng >= -25 && lng <= 45)   return 'europe';
  if (lat >= 15 && lat <= 84 && lng >= -168 && lng <= -50) return 'americas';
  if (lat >= -56 && lat <= 15 && lng >= -82 && lng <= -34) return 'americas';
  if (lat >= -50 && lat <= -10 && lng >= 110 && lng <= 180) return 'oceania';
  if (lat >= 5  && lat <= 38  && lng >= 60  && lng <= 100) return 'south_asia';
  if (lat >= -10 && lat <= 28 && lng >= 95  && lng <= 145) return 'southeast_asia';
  if (lat >= 18 && lat <= 55  && lng >= 100 && lng <= 145) return 'east_asia';
  if (lat >= 12 && lat <= 42  && lng >= 25  && lng <= 65)  return 'middle_east';
  if (lat >= -35 && lat <= 38 && lng >= -20 && lng <= 55)  return 'africa';
  return 'other';
}

/** Regions where auto-rickshaw / tuk-tuk culture exists */
function hasAutoMode(region) {
  return ['south_asia', 'southeast_asia', 'africa', 'middle_east', 'other'].includes(region);
}

/** Local name for the auto-rickshaw mode */
function autoLabel(region) {
  if (region === 'southeast_asia') return 'Tuk-tuk / Grab';
  if (region === 'africa')         return 'Matatu / Tuk-tuk';
  if (region === 'middle_east')    return 'Auto / Microbus';
  return 'Auto / Rickshaw';
}

/**
 * Major international hub airports by region — used as fallback when Overpass
 * returns only small airfields without IATA codes near the user's location.
 * Sorted roughly by international connectivity within each region.
 */
/**
 * Curated list of major international airports with regular long-haul service,
 * grouped by region. Used as fallback when Overpass returns small airfields.
 * Coverage: ~140 airports across all inhabited continents + major island groups.
 */
const REGION_HUBS = {
  // ── Western & Central Europe ───────────────────────────────────────────────
  europe: [
    { name: 'Frankfurt Airport',                   iata: 'FRA', lat:  50.0379, lng:   8.5622 },
    { name: 'London Heathrow Airport',             iata: 'LHR', lat:  51.4700, lng:  -0.4543 },
    { name: 'Paris Charles de Gaulle Airport',     iata: 'CDG', lat:  49.0097, lng:   2.5479 },
    { name: 'Amsterdam Schiphol Airport',          iata: 'AMS', lat:  52.3086, lng:   4.7639 },
    { name: 'Madrid Barajas Airport',              iata: 'MAD', lat:  40.4936, lng:  -3.5668 },
    { name: 'Munich Airport',                      iata: 'MUC', lat:  48.3538, lng:  11.7861 },
    { name: 'Rome Fiumicino Airport',              iata: 'FCO', lat:  41.8003, lng:  12.2389 },
    { name: 'Zürich Airport',                      iata: 'ZRH', lat:  47.4647, lng:   8.5492 },
    { name: 'Vienna International Airport',        iata: 'VIE', lat:  48.1103, lng:  16.5697 },
    { name: 'Brussels Airport',                    iata: 'BRU', lat:  50.9014, lng:   4.4844 },
    { name: 'Copenhagen Airport',                  iata: 'CPH', lat:  55.6180, lng:  12.6561 },
    { name: 'Stockholm Arlanda Airport',           iata: 'ARN', lat:  59.6519, lng:  17.9186 },
    { name: 'Oslo Gardermoen Airport',             iata: 'OSL', lat:  60.1976, lng:  11.1004 },
    { name: 'Helsinki Vantaa Airport',             iata: 'HEL', lat:  60.3172, lng:  24.9633 },
    { name: 'Warsaw Chopin Airport',               iata: 'WAW', lat:  52.1657, lng:  20.9671 },
    { name: 'Prague Václav Havel Airport',         iata: 'PRG', lat:  50.1008, lng:  14.2600 },
    { name: 'Budapest Ferihegy Airport',           iata: 'BUD', lat:  47.4298, lng:  19.2611 },
    { name: 'Lisbon Humberto Delgado Airport',     iata: 'LIS', lat:  38.7742, lng:  -9.1342 },
    { name: 'Athens Eleftherios Venizelos Airport',iata: 'ATH', lat:  37.9364, lng:  23.9445 },
    { name: 'Barcelona El Prat Airport',           iata: 'BCN', lat:  41.2971, lng:   2.0785 },
    { name: 'Milan Malpensa Airport',              iata: 'MXP', lat:  45.6306, lng:   8.7281 },
    { name: 'Dublin Airport',                      iata: 'DUB', lat:  53.4213, lng:  -6.2701 },
    { name: 'Manchester Airport',                  iata: 'MAN', lat:  53.3537, lng:  -2.2750 },
    { name: 'Düsseldorf Airport',                  iata: 'DUS', lat:  51.2895, lng:   6.7668 },
    { name: 'Hamburg Airport',                     iata: 'HAM', lat:  53.6304, lng:  10.0060 },
    { name: 'Lyon Saint-Exupéry Airport',          iata: 'LYS', lat:  45.7256, lng:   5.0811 },
    { name: 'Bucharest Henri Coandă Airport',      iata: 'OTP', lat:  44.5711, lng:  26.0858 },
    { name: 'Sofia Airport',                       iata: 'SOF', lat:  42.6952, lng:  23.4114 },
    { name: 'Zagreb Airport',                      iata: 'ZAG', lat:  45.7429, lng:  16.0688 },
    { name: 'Belgrade Nikola Tesla Airport',       iata: 'BEG', lat:  44.8184, lng:  20.3091 },
  ],
  // ── Russia, Eastern Europe & Central Asia ──────────────────────────────────
  russia_central_asia: [
    { name: 'Moscow Sheremetyevo International Airport', iata: 'SVO', lat:  55.9736, lng:  37.4125 },
    { name: 'Moscow Domodedovo Airport',                 iata: 'DME', lat:  55.4088, lng:  37.9063 },
    { name: 'Moscow Vnukovo Airport',                    iata: 'VKO', lat:  55.5915, lng:  37.2615 },
    { name: 'St. Petersburg Pulkovo Airport',            iata: 'LED', lat:  59.8003, lng:  30.2625 },
    { name: 'Novosibirsk Tolmachevo Airport',            iata: 'OVB', lat:  54.9963, lng:  82.6567 },
    { name: 'Yekaterinburg Koltsovo Airport',            iata: 'SVX', lat:  56.7431, lng:  60.8027 },
    { name: 'Krasnoyarsk Yemelyanovo Airport',           iata: 'KJA', lat:  56.1731, lng:  92.4933 },
    { name: 'Irkutsk Airport',                           iata: 'IKT', lat:  52.2680, lng: 104.3890 },
    { name: 'Vladivostok International Airport',         iata: 'VVO', lat:  43.3990, lng: 132.1480 },
    { name: 'Almaty International Airport',              iata: 'ALA', lat:  43.3521, lng:  77.0404 },
    { name: 'Astana International Airport',              iata: 'NQZ', lat:  51.0223, lng:  71.4669 },
    { name: 'Tashkent Yuzhny Airport',                   iata: 'TAS', lat:  41.2579, lng:  69.2812 },
    { name: 'Baku Heydar Aliyev International Airport',  iata: 'GYD', lat:  40.4675, lng:  50.0467 },
    { name: 'Tbilisi International Airport',             iata: 'TBS', lat:  41.6693, lng:  44.9547 },
    { name: 'Yerevan Zvartnots International Airport',   iata: 'EVN', lat:  40.1473, lng:  44.3959 },
    { name: 'Minsk International Airport',               iata: 'MSQ', lat:  53.8825, lng:  28.0307 },
    { name: 'Kyiv Boryspil International Airport',       iata: 'KBP', lat:  50.3450, lng:  30.8947 },
    { name: 'Bishkek Manas International Airport',       iata: 'FRU', lat:  43.0613, lng:  74.4776 },
    { name: 'Dushanbe International Airport',            iata: 'DYU', lat:  38.5433, lng:  68.7750 },
    { name: 'Ashgabat International Airport',            iata: 'ASB', lat:  37.9868, lng:  58.3610 },
  ],
  // ── South Asia ─────────────────────────────────────────────────────────────
  south_asia: [
    { name: 'Indira Gandhi International Airport',        iata: 'DEL', lat:  28.5562, lng:  77.1000 },
    { name: 'Chhatrapati Shivaji Maharaj International', iata: 'BOM', lat:  19.0896, lng:  72.8656 },
    { name: 'Kempegowda International Airport',           iata: 'BLR', lat:  13.1979, lng:  77.7063 },
    { name: 'Chennai International Airport',              iata: 'MAA', lat:  12.9900, lng:  80.1693 },
    { name: 'Netaji Subhas Chandra Bose International',   iata: 'CCU', lat:  22.6520, lng:  88.4463 },
    { name: 'Hyderabad Rajiv Gandhi International',       iata: 'HYD', lat:  17.2403, lng:  78.4294 },
    { name: 'Cochin International Airport',               iata: 'COK', lat:  10.1520, lng:  76.3919 },
    { name: 'Goa Dabolim Airport',                        iata: 'GOI', lat:  15.3808, lng:  73.8314 },
    { name: 'Ahmedabad Sardar Vallabhbhai Patel Int\'l',  iata: 'AMD', lat:  23.0772, lng:  72.6347 },
    { name: 'Islamabad International Airport',            iata: 'ISB', lat:  33.5497, lng:  72.8262 },
    { name: 'Lahore Allama Iqbal International Airport',  iata: 'LHE', lat:  31.5216, lng:  74.4036 },
    { name: 'Karachi Jinnah International Airport',       iata: 'KHI', lat:  24.9065, lng:  67.1608 },
    { name: 'Hazrat Shahjalal International Airport',     iata: 'DAC', lat:  23.8433, lng:  90.3979 },
    { name: 'Tribhuvan International Airport (Kathmandu)',iata: 'KTM', lat:  27.6966, lng:  85.3591 },
    { name: 'Bandaranaike International Airport',         iata: 'CMB', lat:   7.1808, lng:  79.8841 },
    { name: 'Velana International Airport (Maldives)',    iata: 'MLE', lat:   4.1918, lng:  73.5290 },
    { name: 'Paro International Airport (Bhutan)',        iata: 'PBH', lat:  27.4032, lng:  89.4246 },
  ],
  // ── Southeast Asia ─────────────────────────────────────────────────────────
  southeast_asia: [
    { name: 'Suvarnabhumi Airport (Bangkok)',          iata: 'BKK', lat:  13.6900, lng: 100.7501 },
    { name: 'Don Mueang International Airport',        iata: 'DMK', lat:  13.9126, lng: 100.6070 },
    { name: 'Singapore Changi Airport',                iata: 'SIN', lat:   1.3644, lng: 103.9915 },
    { name: 'Kuala Lumpur International Airport',      iata: 'KUL', lat:   2.7456, lng: 101.7072 },
    { name: 'Ninoy Aquino International Airport',      iata: 'MNL', lat:  14.5086, lng: 121.0194 },
    { name: 'Tan Son Nhat International Airport',      iata: 'SGN', lat:  10.8188, lng: 106.6520 },
    { name: 'Noi Bai International Airport (Hanoi)',   iata: 'HAN', lat:  21.2212, lng: 105.8072 },
    { name: 'Soekarno–Hatta International Airport',   iata: 'CGK', lat:  -6.1256, lng: 106.6559 },
    { name: 'Ngurah Rai International Airport (Bali)', iata: 'DPS', lat:  -8.7482, lng: 115.1670 },
    { name: 'Yangon International Airport',            iata: 'RGN', lat:  16.9073, lng:  96.1332 },
    { name: 'Phnom Penh International Airport',        iata: 'PNH', lat:  11.5466, lng: 104.8440 },
    { name: 'Wattay International Airport (Vientiane)',iata: 'VTE', lat:  17.9883, lng: 102.5633 },
    { name: 'Bandar Seri Begawan Airport (Brunei)',    iata: 'BWN', lat:   4.9442, lng: 114.9280 },
    { name: 'Yangon Mandalay Airport',                 iata: 'MDL', lat:  21.7022, lng:  95.9779 },
    { name: 'Cebu Mactan International Airport',       iata: 'CEB', lat:  10.3075, lng: 123.9790 },
    { name: 'Da Nang International Airport',           iata: 'DAD', lat:  16.0439, lng: 108.1993 },
  ],
  // ── East Asia ──────────────────────────────────────────────────────────────
  east_asia: [
    { name: 'Beijing Capital International Airport',   iata: 'PEK', lat:  40.0799, lng: 116.6031 },
    { name: 'Beijing Daxing International Airport',    iata: 'PKX', lat:  39.5098, lng: 116.4105 },
    { name: 'Shanghai Pudong International Airport',   iata: 'PVG', lat:  31.1443, lng: 121.8083 },
    { name: 'Shanghai Hongqiao International Airport', iata: 'SHA', lat:  31.1979, lng: 121.3363 },
    { name: 'Guangzhou Baiyun International Airport',  iata: 'CAN', lat:  23.3924, lng: 113.2988 },
    { name: 'Shenzhen Bao\'an International Airport',  iata: 'SZX', lat:  22.6393, lng: 113.8107 },
    { name: 'Chengdu Tianfu International Airport',    iata: 'TFU', lat:  30.3124, lng: 104.4440 },
    { name: 'Kunming Changshui International Airport', iata: 'KMG', lat:  25.1019, lng: 102.9292 },
    { name: 'Tokyo Narita International Airport',      iata: 'NRT', lat:  35.7720, lng: 140.3929 },
    { name: 'Tokyo Haneda Airport',                    iata: 'HND', lat:  35.5493, lng: 139.7798 },
    { name: 'Osaka Kansai International Airport',      iata: 'KIX', lat:  34.4272, lng: 135.2440 },
    { name: 'Incheon International Airport (Seoul)',   iata: 'ICN', lat:  37.4602, lng: 126.4407 },
    { name: 'Gimpo International Airport (Seoul)',     iata: 'GMP', lat:  37.5583, lng: 126.7906 },
    { name: 'Hong Kong International Airport',         iata: 'HKG', lat:  22.3080, lng: 113.9185 },
    { name: 'Taiwan Taoyuan International Airport',    iata: 'TPE', lat:  25.0777, lng: 121.2327 },
    { name: 'Macau International Airport',             iata: 'MFM', lat:  22.1496, lng: 113.5920 },
    { name: 'Ulaanbaatar Chinggis Khaan Airport',      iata: 'ULN', lat:  47.8431, lng: 106.7664 },
  ],
  // ── North & Central America ────────────────────────────────────────────────
  americas: [
    { name: 'John F. Kennedy International Airport',        iata: 'JFK', lat:  40.6413, lng:  -73.7781 },
    { name: 'Los Angeles International Airport',            iata: 'LAX', lat:  33.9425, lng: -118.4081 },
    { name: "O'Hare International Airport (Chicago)",       iata: 'ORD', lat:  41.9742, lng:  -87.9073 },
    { name: 'Miami International Airport',                  iata: 'MIA', lat:  25.7959, lng:  -80.2870 },
    { name: 'Dallas/Fort Worth International Airport',      iata: 'DFW', lat:  32.8998, lng:  -97.0403 },
    { name: 'Atlanta Hartsfield-Jackson Airport',           iata: 'ATL', lat:  33.6407, lng:  -84.4277 },
    { name: 'San Francisco International Airport',          iata: 'SFO', lat:  37.6213, lng: -122.3790 },
    { name: 'Seattle–Tacoma International Airport',         iata: 'SEA', lat:  47.4502, lng: -122.3088 },
    { name: 'Toronto Pearson International Airport',        iata: 'YYZ', lat:  43.6777, lng:  -79.6248 },
    { name: 'Vancouver International Airport',              iata: 'YVR', lat:  49.1967, lng: -123.1815 },
    { name: 'Montréal Trudeau International Airport',       iata: 'YUL', lat:  45.4706, lng:  -73.7408 },
    { name: 'Mexico City Benito Juárez International',      iata: 'MEX', lat:  19.4363, lng:  -99.0721 },
    { name: 'Cancún International Airport',                 iata: 'CUN', lat:  21.0365, lng:  -86.8771 },
    { name: 'Guatemala City La Aurora International',       iata: 'GUA', lat:  14.5833, lng:  -90.5275 },
    { name: 'Panama City Tocumen International Airport',    iata: 'PTY', lat:   9.0714, lng:  -79.3835 },
    { name: 'San José Juan Santamaría Airport (Costa Rica)',iata: 'SJO', lat:   9.9939, lng:  -84.2089 },
    { name: 'Havana José Martí International Airport',      iata: 'HAV', lat:  22.9892, lng:  -82.4091 },
    { name: 'Punta Cana International Airport',             iata: 'PUJ', lat:  18.5674, lng:  -68.3634 },
    // South America
    { name: 'São Paulo Guarulhos International Airport',    iata: 'GRU', lat: -23.4356, lng:  -46.4731 },
    { name: 'Rio de Janeiro Galeão Airport',                iata: 'GIG', lat: -22.8099, lng:  -43.2506 },
    { name: 'Buenos Aires Ezeiza International Airport',    iata: 'EZE', lat: -34.8222, lng:  -58.5358 },
    { name: 'Santiago Arturo Merino Benítez Airport',       iata: 'SCL', lat: -33.3930, lng:  -70.7858 },
    { name: 'Bogotá El Dorado International Airport',       iata: 'BOG', lat:   4.7016, lng:  -74.1469 },
    { name: 'Lima Jorge Chávez International Airport',      iata: 'LIM', lat: -12.0219, lng:  -77.1143 },
    { name: 'Caracas Simón Bolívar International Airport',  iata: 'CCS', lat:  10.6031, lng:  -66.9912 },
    { name: 'Quito Mariscal Sucre International Airport',   iata: 'UIO', lat:  -0.1292, lng:  -78.3575 },
  ],
  // ── Middle East ────────────────────────────────────────────────────────────
  middle_east: [
    { name: 'Dubai International Airport',                 iata: 'DXB', lat:  25.2532, lng:  55.3657 },
    { name: 'Hamad International Airport (Doha)',          iata: 'DOH', lat:  25.2609, lng:  51.6138 },
    { name: 'Abu Dhabi International Airport',             iata: 'AUH', lat:  24.4330, lng:  54.6511 },
    { name: 'Istanbul Airport',                            iata: 'IST', lat:  41.2753, lng:  28.7519 },
    { name: 'Tel Aviv Ben Gurion Airport',                 iata: 'TLV', lat:  32.0055, lng:  34.8854 },
    { name: 'Riyadh King Khalid International Airport',    iata: 'RUH', lat:  24.9578, lng:  46.6988 },
    { name: 'Jeddah King Abdulaziz International Airport', iata: 'JED', lat:  21.6796, lng:  39.1565 },
    { name: 'Muscat International Airport',                iata: 'MCT', lat:  23.5933, lng:  58.2844 },
    { name: 'Kuwait International Airport',                iata: 'KWI', lat:  29.2267, lng:  47.9689 },
    { name: 'Amman Queen Alia International Airport',      iata: 'AMM', lat:  31.7226, lng:  35.9932 },
    { name: 'Bahrain International Airport',               iata: 'BAH', lat:  26.2708, lng:  50.6336 },
    { name: 'Beirut Rafic Hariri International Airport',   iata: 'BEY', lat:  33.8209, lng:  35.4884 },
    { name: 'Baghdad International Airport',               iata: 'BGW', lat:  33.2625, lng:  44.2346 },
    { name: 'Tehran Imam Khomeini International Airport',  iata: 'IKA', lat:  35.4161, lng:  51.1522 },
    { name: 'Kabul International Airport',                 iata: 'KBL', lat:  34.5659, lng:  69.2122 },
  ],
  // ── Africa ─────────────────────────────────────────────────────────────────
  africa: [
    { name: 'O.R. Tambo International Airport (Joburg)',   iata: 'JNB', lat: -26.1392, lng:  28.2460 },
    { name: 'Cape Town International Airport',             iata: 'CPT', lat: -33.9648, lng:  18.6017 },
    { name: 'Cairo International Airport',                 iata: 'CAI', lat:  30.1219, lng:  31.4056 },
    { name: 'Mohammed V International Airport (Casablanca)',iata:'CMN', lat:  33.3675, lng:  -7.5898 },
    { name: 'Addis Ababa Bole International Airport',      iata: 'ADD', lat:   8.9779, lng:  38.7993 },
    { name: 'Nairobi Jomo Kenyatta International Airport', iata: 'NBO', lat:  -1.3192, lng:  36.9275 },
    { name: 'Lagos Murtala Muhammed International Airport',iata: 'LOS', lat:   6.5774, lng:   3.3215 },
    { name: 'Accra Kotoka International Airport',          iata: 'ACC', lat:   5.6052, lng:  -0.1669 },
    { name: 'Dakar Blaise Diagne International Airport',   iata: 'DSS', lat:  14.6700, lng: -17.0726 },
    { name: 'Tunis Carthage International Airport',        iata: 'TUN', lat:  36.8510, lng:  10.2272 },
    { name: 'Algiers Houari Boumediene Airport',           iata: 'ALG', lat:  36.6910, lng:   3.2154 },
    { name: 'Abidjan Félix-Houphouët-Boigny Airport',     iata: 'ABJ', lat:   5.2613, lng:  -3.9263 },
    { name: 'Dar es Salaam Julius Nyerere International', iata: 'DAR', lat:  -6.8781, lng:  39.2026 },
    { name: 'Lusaka Kenneth Kaunda International Airport', iata: 'LUN', lat: -15.3308, lng:  28.4526 },
    { name: 'Harare Robert Mugabe International Airport',  iata: 'HRE', lat: -17.9318, lng:  31.0928 },
    { name: 'Casablanca Mohammed V Airport',               iata: 'CMN', lat:  33.3675, lng:  -7.5898 },
    { name: 'Douala International Airport (Cameroon)',     iata: 'DLA', lat:   4.0061, lng:   9.7195 },
    { name: 'Maputo International Airport',                iata: 'MPM', lat: -25.9208, lng:  32.5726 },
  ],
  // ── Oceania & Pacific ───────────────────────────────────────────────────────
  oceania: [
    { name: 'Sydney Kingsford Smith Airport',          iata: 'SYD', lat: -33.9399, lng: 151.1753 },
    { name: 'Melbourne Airport',                       iata: 'MEL', lat: -37.6690, lng: 144.8410 },
    { name: 'Brisbane Airport',                        iata: 'BNE', lat: -27.3842, lng: 153.1175 },
    { name: 'Perth Airport',                           iata: 'PER', lat: -31.9403, lng: 115.9669 },
    { name: 'Adelaide Airport',                        iata: 'ADL', lat: -34.9450, lng: 138.5306 },
    { name: 'Auckland Airport',                        iata: 'AKL', lat: -37.0082, lng: 174.7850 },
    { name: 'Christchurch Airport',                    iata: 'CHC', lat: -43.4894, lng: 172.5322 },
    { name: 'Nadi International Airport (Fiji)',       iata: 'NAN', lat: -17.7554, lng: 177.4431 },
    { name: 'Port Moresby Jackson\'s Airport (PNG)',   iata: 'POM', lat:  -9.4434, lng: 147.2200 },
    { name: 'Honiara International Airport (Solomon)', iata: 'HIR', lat:  -9.4280, lng: 160.0547 },
    { name: 'Tahiti Faa\'a Airport (French Polynesia)',iata: 'PPT', lat: -17.5534, lng:-149.6063 },
    { name: 'Honolulu Daniel K. Inouye Airport',       iata: 'HNL', lat:  21.3245, lng:-157.9251 },
    { name: 'Guam A.B. Won Pat International',         iata: 'GUM', lat:  13.4834, lng: 144.7963 },
  ],
};

/**
 * Flat list of ALL hubs for global nearest-airport search.
 * This is the key to correct airport selection regardless of region detection accuracy.
 */
const ALL_HUBS = Object.values(REGION_HUBS).flat();

/**
 * Pick the best departure/arrival airport for a flight route.
 *
 * Strategy:
 *  - Intercontinental routes: always use nearest known hub (global search).
 *    Small/regional airports and under-construction OSM entries never have long-haul service.
 *  - Regional/domestic routes: nearest IATA airport from OSM Overpass is fine,
 *    with hub list as fallback when OSM returns nothing useful.
 *
 * Using ALL_HUBS (global search) as the foundation means region detection
 * inaccuracies (e.g. Russia falling into 'other') don't cause wrong airports.
 */
function pickBestAirport(osmAirports, region, refLat, refLng, isIntercontinental = false) {
  // Compute distance from reference point to every hub, sort nearest-first
  const globalHubs = ALL_HUBS.map(h => ({
    ...h,
    distance: distanceKm(refLat, refLng, h.lat, h.lng),
    source: 'hub',
  })).sort((a, b) => a.distance - b.distance);

  const nearestHub = globalHubs[0];

  if (isIntercontinental) {
    // Always use a curated hub for long-haul — never trust small airfields or
    // under-construction OSM airports for international service.
    return nearestHub || osmAirports[0] || null;
  }

  // Regional / domestic: prefer the curated hub list over raw OSM airports.
  // OSM frequently returns military, private, and under-construction airports
  // (e.g. Hindon, Noida International) that have IATA codes but no scheduled
  // commercial service.  Only use an OSM airport if it is substantially closer
  // than the nearest hub (< 60% of the hub's distance).
  const withIata = osmAirports.find(a => a.iata);
  if (nearestHub && withIata) {
    const OSM_HUB_RATIO = 0.6;
    if (nearestHub.distance <= withIata.distance ||
        withIata.distance > nearestHub.distance * OSM_HUB_RATIO) {
      return nearestHub;
    }
    return withIata;
  }
  if (withIata) return withIata;

  // Any OSM airport within 50 km (small-country domestic airports with no hub nearby)
  const close = osmAirports.find(a => a.distance <= 50);
  if (close) return close;

  return nearestHub || null;
}

function distanceKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearbyBusStops(lat, lng, radiusKm = 3) {
  return db.findAll('bus_stops')
    .map(s => ({ ...s, distance: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
}

function getNearbyMetroStations(lat, lng, radiusKm = 5) {
  return db.findAll('metro_stations')
    .map(s => ({ ...s, distance: distanceKm(lat, lng, s.lat, s.lng) }))
    .filter(s => s.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 4);
}

function timeToMinutes(time) {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function getNextScheduledTime(type, stopId, fromDate = null) {
  const ref = fromDate ? new Date(fromDate) : new Date();
  const currentMinutes = ref.getHours() * 60 + ref.getMinutes();

  if (type === 'bus') {
    const schedules = db.findAll('bus_schedules', { stop_id: stopId });
    if (!schedules.length) {
      // Estimated: bus every 15 min
      const waitMins = 15 - (currentMinutes % 15);
      return { next: minutesToTime(currentMinutes + waitMins), waitMinutes: waitMins, frequency: 15 };
    }
    const freq = schedules[0].frequency_minutes;
    const firstMins = timeToMinutes(schedules[0].departure_time);
    const elapsed = currentMinutes - firstMins;
    const waitMins = elapsed < 0 ? Math.abs(elapsed) : freq - (elapsed % freq);
    return { next: minutesToTime(currentMinutes + waitMins), waitMinutes: waitMins, frequency: freq };
  } else {
    const schedule = db.findOne('metro_schedules', { station_id: stopId });
    if (!schedule) {
      // Estimated: metro every 5 min
      const waitMins = 5 - (currentMinutes % 5);
      return { next: minutesToTime(currentMinutes + waitMins), waitMinutes: waitMins, frequency: 5 };
    }
    const freq = schedule.frequency_minutes;
    const firstMins = timeToMinutes(schedule.first_train);
    const elapsed = currentMinutes - firstMins;
    const waitMins = elapsed < 0 ? Math.abs(elapsed) : freq - (elapsed % freq);
    return { next: minutesToTime(currentMinutes + waitMins), waitMinutes: waitMins, frequency: freq };
  }
}

// For OSM-sourced stops, estimate a schedule
function estimatedSchedule(type, fromDate = null) {
  const ref = fromDate ? new Date(fromDate) : new Date();
  const currentMinutes = ref.getHours() * 60 + ref.getMinutes();
  const freq = type === 'metro' ? 5 : 15;
  const waitMins = freq - (currentMinutes % freq);
  return { next: minutesToTime(currentMinutes + waitMins), waitMinutes: waitMins, frequency: freq };
}

function duration(mode, distKm) {
  return Math.ceil((distKm / (MODE_SPEEDS_KMH[mode] || 20)) * 60);
}

/**
 * Generate a human-readable flight schedule note based on airport type.
 * Hub airports (from curated list) have many daily flights.
 * OSM-only airports may have limited or no scheduled service.
 */
function airportScheduleNote(apt, endApt) {
  const originNote = (apt && apt.source !== 'osm')
    ? `${apt.iata ? apt.iata + ' — ' : ''}${apt.name}: major hub, many daily departures`
    : `${apt?.name || 'Origin airport'}: regional airport — verify flight schedule`;
  const destNote = (endApt && endApt.source !== 'osm')
    ? `${endApt.iata ? endApt.iata + ' — ' : ''}${endApt.name}: major hub, many daily arrivals`
    : `${endApt?.name || 'Destination airport'}: regional airport — verify flight availability`;
  return `${originNote}. ${destNote}. Allow 2–3 h check-in & security.`;
}

function getScheduleForStop(stop, type, fromDate) {
  if (stop.source === 'osm') return estimatedSchedule(type, fromDate);
  return getNextScheduledTime(type, stop.id, fromDate);
}

/**
 * Plan a journey between two points.
 * Uses local DB first; falls back to worldwide OSM Overpass data if local has nothing nearby.
 * Always includes direct auto/taxi/car_bike options regardless of transit availability.
 */
async function planJourney({ startLat, startLng, startName, endLat, endLng, endName, maxModes = 3, scheduleTime = null, preferredModes = [] }) {
  const fromDate = scheduleTime ? new Date(scheduleTime) : null;
  const totalDist = distanceKm(startLat, startLng, endLat, endLng);
  const region = detectRegion(startLat, startLng);
  const showAuto = hasAutoMode(region);
  const autoName = autoLabel(region);
  // Destination region — used for last-leg connecting mode
  const endRegion = detectRegion(endLat, endLng);
  const endShowAuto = hasAutoMode(endRegion);
  const endConnectMode = endShowAuto ? 'auto' : 'taxi';

  // 1. Try local DB (seeded stops for any pre-loaded city)
  let nearbyStartBus    = getNearbyBusStops(startLat, startLng);
  let nearbyStartMetro  = getNearbyMetroStations(startLat, startLng);
  let nearbyEndBus      = getNearbyBusStops(endLat, endLng);
  let nearbyEndMetro    = getNearbyMetroStations(endLat, endLng);
  let nearbyStartTrain  = [];
  let nearbyEndTrain    = [];
  let nearbyStartFerry  = [];
  let nearbyEndFerry    = [];
  let nearbyStartAir    = [];
  let nearbyEndAir      = [];

  // 2. Always enrich with worldwide OSM data via Overpass (covers any city on earth)
  //    Run both fetches in parallel for speed
  const [osmStart, osmEnd] = await Promise.allSettled([
    fetchNearbyTransit(startLat, startLng),
    fetchNearbyTransit(endLat, endLng),
  ]);

  if (osmStart.status === 'fulfilled') {
    const v = osmStart.value;
    const osmBusIds   = new Set(nearbyStartBus.map(s => s.id));
    const osmMetroIds = new Set(nearbyStartMetro.map(s => s.id));
    for (const s of v.busStops)      { if (!osmBusIds.has(s.id))   nearbyStartBus.push(s); }
    for (const s of v.metroStations) { if (!osmMetroIds.has(s.id)) nearbyStartMetro.push(s); }
    nearbyStartTrain = v.trainStations  || [];
    nearbyStartFerry = v.ferryTerminals || [];
    nearbyStartAir   = v.airports       || [];
    nearbyStartBus.sort((a, b) => a.distance - b.distance);
    nearbyStartMetro.sort((a, b) => a.distance - b.distance);
  } else {
    console.warn('[routePlanner] Overpass start failed:', osmStart.reason?.message);
  }

  if (osmEnd.status === 'fulfilled') {
    const v = osmEnd.value;
    const osmBusIds   = new Set(nearbyEndBus.map(s => s.id));
    const osmMetroIds = new Set(nearbyEndMetro.map(s => s.id));
    for (const s of v.busStops)      { if (!osmBusIds.has(s.id))   nearbyEndBus.push(s); }
    for (const s of v.metroStations) { if (!osmMetroIds.has(s.id)) nearbyEndMetro.push(s); }
    nearbyEndTrain = v.trainStations  || [];
    nearbyEndFerry = v.ferryTerminals || [];
    nearbyEndAir   = v.airports       || [];
    nearbyEndBus.sort((a, b) => a.distance - b.distance);
    nearbyEndMetro.sort((a, b) => a.distance - b.distance);
  } else {
    console.warn('[routePlanner] Overpass end failed:', osmEnd.reason?.message);
  }

  const routes = [];

  // Local transit (bus/metro) is only sensible for shorter journeys.
  // For long-distance routes, only Air / Train / Ferry / Taxi / Car make sense.
  const LOCAL_TRANSIT_MAX_KM = 150;
  const useLocalTransit = totalDist <= LOCAL_TRANSIT_MAX_KM;

  // ── Case 1: Single mode ────────────────────────────────────────────────────
  if (maxModes >= 1 && useLocalTransit) {
    if (nearbyStartBus.length) {
      const stop = nearbyStartBus[0];
      const sched = getScheduleForStop(stop, 'bus', fromDate);
      routes.push({
        case: 1, label: 'Direct Bus',
        legs: [{ mode: 'bus', from: startName, to: endName,
          boardingStop: stop.name, alightingStop: nearbyEndBus[0]?.name || endName,
          stop: stop.name, routeId: stop.route_id,
          distanceKm: totalDist.toFixed(2), cost: cost('bus', totalDist, region), durationMins: duration('bus', totalDist),
          nextScheduled: sched.next, waitMinutes: sched.waitMinutes, frequency: sched.frequency }],
        totalCost: cost('bus', totalDist, region),
        totalDurationMins: duration('bus', totalDist) + (sched.waitMinutes || 0),
        totalDistanceKm: totalDist.toFixed(2),
      });
    }

    if (nearbyStartMetro.length) {
      const station = nearbyStartMetro[0];
      const sched = getScheduleForStop(station, 'metro', fromDate);
      routes.push({
        case: 1, label: 'Direct Metro',
        legs: [{ mode: 'metro', from: startName, to: endName,
          boardingStop: station.name, alightingStop: nearbyEndMetro[0]?.name || endName,
          station: station.name, line: station.line,
          distanceKm: totalDist.toFixed(2), cost: cost('metro', totalDist, region), durationMins: duration('metro', totalDist),
          nextScheduled: sched.next, waitMinutes: sched.waitMinutes, frequency: sched.frequency }],
        totalCost: cost('metro', totalDist, region),
        totalDurationMins: duration('metro', totalDist) + (sched.waitMinutes || 0),
        totalDistanceKm: totalDist.toFixed(2),
      });
    }
  }

  // ── Case 2: Two modes — pre-mode + Bus/Metro ───────────────────────────────
  // Walking threshold: 2 km (realistic urban walk to transit)
  const WALK_THRESHOLD_KM = 2;

  if (maxModes >= 2 && useLocalTransit && nearbyStartBus.length) {
    const stop = nearbyStartBus[0];
    const leg1Dist = stop.distance;
    const leg2Dist = Math.max(0.1, totalDist - leg1Dist);
    const sched = getScheduleForStop(stop, 'bus', fromDate);

    const preModesBus = ['taxi', 'walking'];
    if (showAuto) preModesBus.unshift('auto');

    for (const preMode of preModesBus) {
      if (preMode === 'walking' && leg1Dist > WALK_THRESHOLD_KM) continue;
      const label = preMode === 'auto' ? `${autoName} + Bus` : `${preMode.charAt(0).toUpperCase() + preMode.slice(1)} + Bus`;
      routes.push({
        case: 2, label,
        legs: [
          { mode: preMode, from: startName, to: stop.name, distanceKm: leg1Dist.toFixed(2), cost: cost(preMode, leg1Dist, region), durationMins: duration(preMode, leg1Dist) },
          { mode: 'bus', from: stop.name, to: endName,
            boardingStop: stop.name, alightingStop: nearbyEndBus[0]?.name || endName,
            stop: stop.name, routeId: stop.route_id,
            distanceKm: leg2Dist.toFixed(2), cost: cost('bus', leg2Dist, region), durationMins: duration('bus', leg2Dist),
            nextScheduled: sched.next, waitMinutes: sched.waitMinutes, frequency: sched.frequency },
        ],
        totalCost: cost(preMode, leg1Dist, region) + cost('bus', leg2Dist, region),
        totalDurationMins: duration(preMode, leg1Dist) + (sched.waitMinutes || 0) + duration('bus', leg2Dist),
        totalDistanceKm: totalDist.toFixed(2),
      });
    }
  }

  if (maxModes >= 2 && useLocalTransit && nearbyStartMetro.length) {
    const station = nearbyStartMetro[0];
    const mSched = getScheduleForStop(station, 'metro', fromDate);
    const mDist = Math.max(0.1, totalDist - station.distance);

    const preModesMetro = ['taxi', 'walking'];
    if (showAuto) preModesMetro.unshift('auto');

    for (const preMode of preModesMetro) {
      if (preMode === 'walking' && station.distance > WALK_THRESHOLD_KM) continue;
      const label = preMode === 'auto' ? `${autoName} + Metro` : `${preMode.charAt(0).toUpperCase() + preMode.slice(1)} + Metro`;
      routes.push({
        case: 2, label,
        legs: [
          { mode: preMode, from: startName, to: station.name, distanceKm: station.distance.toFixed(2), cost: cost(preMode, station.distance, region), durationMins: duration(preMode, station.distance) },
          { mode: 'metro', from: station.name, to: endName,
            boardingStop: station.name, alightingStop: nearbyEndMetro[0]?.name || endName,
            station: station.name, line: station.line,
            distanceKm: mDist.toFixed(2), cost: cost('metro', mDist, region), durationMins: duration('metro', mDist),
            nextScheduled: mSched.next, waitMinutes: mSched.waitMinutes, frequency: mSched.frequency },
        ],
        totalCost: cost(preMode, station.distance, region) + cost('metro', mDist, region),
        totalDurationMins: duration(preMode, station.distance) + (mSched.waitMinutes || 0) + duration('metro', mDist),
        totalDistanceKm: totalDist.toFixed(2),
      });
    }
  }

  // ── Case 3: Three modes ────────────────────────────────────────────────────
  if (maxModes >= 3 && useLocalTransit && nearbyStartMetro.length && nearbyEndBus.length) {
    const station = nearbyStartMetro[0];
    const endStop = nearbyEndBus[0];
    const leg1Dist = station.distance;
    const leg2Dist = Math.max(0.1, totalDist - leg1Dist - endStop.distance);
    const leg3Dist = endStop.distance;
    const mSched = getScheduleForStop(station, 'metro', fromDate);

    const preModesCase3 = ['walking'];
    if (showAuto) preModesCase3.unshift('auto');

    for (const preMode of preModesCase3) {
      if (preMode === 'walking' && leg1Dist > WALK_THRESHOLD_KM) continue;
      const lastLegMode = showAuto ? 'auto' : 'taxi';
      const lastLegLabel = showAuto ? autoName : 'Taxi';
      const label = preMode === 'auto'
        ? `${autoName} + Metro + ${lastLegLabel}`
        : `Walk + Metro + ${lastLegLabel}`;
      routes.push({
        case: 3, label,
        legs: [
          { mode: preMode, from: startName, to: station.name, distanceKm: leg1Dist.toFixed(2), cost: cost(preMode, leg1Dist, region), durationMins: duration(preMode, leg1Dist) },
          { mode: 'metro', from: station.name, to: endStop.name,
            boardingStop: station.name, alightingStop: endStop.name,
            station: station.name, line: station.line,
            distanceKm: leg2Dist.toFixed(2), cost: cost('metro', leg2Dist, region), durationMins: duration('metro', leg2Dist),
            nextScheduled: mSched.next, waitMinutes: mSched.waitMinutes, frequency: mSched.frequency },
          { mode: lastLegMode, from: endStop.name, to: endName, distanceKm: leg3Dist.toFixed(2), cost: cost(lastLegMode, leg3Dist, endRegion), durationMins: duration(lastLegMode, leg3Dist) },
        ],
        totalCost: cost(preMode, leg1Dist, region) + cost('metro', leg2Dist, region) + cost(lastLegMode, leg3Dist, endRegion),
        totalDurationMins: duration(preMode, leg1Dist) + (mSched.waitMinutes || 0) + duration('metro', leg2Dist) + duration(lastLegMode, leg3Dist),
        totalDistanceKm: totalDist.toFixed(2),
      });
    }
  }

  // ── Train routes — only within the same region and reasonable distance ────
  // Intercontinental train travel (e.g. Europe → Asia) is not possible.
  const TRAIN_MAX_KM = 3000;
  const sameRegion = region === endRegion;
  if (nearbyStartTrain.length && sameRegion && totalDist <= TRAIN_MAX_KM) {
    const station = nearbyStartTrain[0];
    const leg1Dist = station.distance;
    const leg2Dist = Math.max(0.1, totalDist - leg1Dist - (nearbyEndTrain[0]?.distance || 0));
    const connectMode = showAuto ? 'auto' : 'taxi';
    const destStation = nearbyEndTrain[0]?.name || endName;
    routes.push({
      case: 4, label: 'Train',
      legs: [
        { mode: connectMode, from: startName, to: station.name, distanceKm: leg1Dist.toFixed(2), cost: cost(connectMode, leg1Dist, region), durationMins: duration(connectMode, leg1Dist) },
        { mode: 'train', from: station.name, to: destStation,
          boardingStop: station.name, alightingStop: destStation,
          station: station.name, line: station.line,
          distanceKm: leg2Dist.toFixed(2), cost: cost('train', leg2Dist, region), durationMins: duration('train', leg2Dist),
          nextScheduled: null, waitMinutes: 20, frequency: 60 },
        ...(nearbyEndTrain[0] ? [{ mode: connectMode, from: destStation, to: endName, distanceKm: nearbyEndTrain[0].distance.toFixed(2), cost: cost(connectMode, nearbyEndTrain[0].distance, endRegion), durationMins: duration(connectMode, nearbyEndTrain[0].distance) }] : []),
      ],
      totalCost: cost(connectMode, leg1Dist, region) + cost('train', leg2Dist, region) + (nearbyEndTrain[0] ? cost(connectMode, nearbyEndTrain[0].distance, endRegion) : 0),
      totalDurationMins: duration(connectMode, leg1Dist) + 20 + duration('train', leg2Dist) + (nearbyEndTrain[0] ? duration(connectMode, nearbyEndTrain[0].distance) : 0),
      totalDistanceKm: totalDist.toFixed(2),
    });
  }

  // ── Ferry routes — needs terminals at both ends, max ~5000 km sea route ───
  const FERRY_MAX_KM = 5000;
  if (nearbyStartFerry.length && nearbyEndFerry.length && totalDist <= FERRY_MAX_KM) {
    const ft = nearbyStartFerry[0];
    const leg1Dist = ft.distance;
    const leg2Dist = Math.max(0.1, totalDist - leg1Dist - nearbyEndFerry[0].distance);
    const startConnect = showAuto ? 'auto' : 'taxi';
    routes.push({
      case: 4, label: 'Ferry / Ship',
      legs: [
        { mode: startConnect, from: startName, to: ft.name, distanceKm: leg1Dist.toFixed(2), cost: cost(startConnect, leg1Dist, region), durationMins: duration(startConnect, leg1Dist) },
        { mode: 'ferry', from: ft.name, to: nearbyEndFerry[0].name,
          boardingStop: ft.name, alightingStop: nearbyEndFerry[0].name,
          terminal: ft.name, operator: ft.operator,
          distanceKm: leg2Dist.toFixed(2), cost: cost('ferry', leg2Dist, region), durationMins: duration('ferry', leg2Dist),
          nextScheduled: null, waitMinutes: 30, frequency: 120 },
        { mode: endConnectMode, from: nearbyEndFerry[0].name, to: endName, distanceKm: nearbyEndFerry[0].distance.toFixed(2), cost: cost(endConnectMode, nearbyEndFerry[0].distance, endRegion), durationMins: duration(endConnectMode, nearbyEndFerry[0].distance) },
      ],
      totalCost: cost(startConnect, leg1Dist, region) + cost('ferry', leg2Dist, region) + cost(endConnectMode, nearbyEndFerry[0].distance, endRegion),
      totalDurationMins: duration(startConnect, leg1Dist) + 30 + duration('ferry', leg2Dist) + duration(endConnectMode, nearbyEndFerry[0].distance),
      totalDistanceKm: totalDist.toFixed(2),
    });
  }

  // ── Air routes — realistic multi-leg variants ─────────────────────────────
  const isIntercontinental = !sameRegion;
  if (totalDist > 100 && (nearbyStartAir.length || isIntercontinental)) {
    // Pick best airport — for intercontinental routes, always prefers major hubs
    // (e.g. Frankfurt FRA over Mannheim City Airport for Germany → India)
    const apt          = pickBestAirport(nearbyStartAir, region,    startLat, startLng, isIntercontinental);
    const endApt       = pickBestAirport(nearbyEndAir,   endRegion, endLat,   endLng,   isIntercontinental);
    const aptDist      = apt    ? apt.distance    : 30;
    const endAptDist   = endApt ? endApt.distance : 30;
    const startAptName = apt    ? apt.name        : `${startName} International Airport`;
    const endAptName   = endApt ? endApt.name     : `${endName} International Airport`;
    const flightDist   = Math.max(1, totalDist - aptDist - endAptDist);

    const flightLeg = {
      mode: 'air', from: startAptName, to: endAptName,
      airport: startAptName, iata: apt?.iata || null,
      destAirport: endAptName, destIata: endApt?.iata || null,
      distanceKm: flightDist.toFixed(2), cost: cost('air', flightDist, region),
      durationMins: duration('air', flightDist),
      waitMinutes: 150, // ~2.5h check-in + security
      note: airportScheduleNote(apt, endApt),
    };

    function legsTotals(legs) {
      return {
        totalCost: Math.round(legs.reduce((s, l) => s + (l.cost || 0), 0) * 100) / 100,
        totalDurationMins: legs.reduce((s, l) => s + (l.durationMins || 0) + (l.waitMinutes || 0), 0),
      };
    }

    // ── Build origin → airport options ─────────────────────────────────────
    const originOpts = [];
    const sTrain = nearbyStartTrain[0] || null;
    const sMetro = nearbyStartMetro[0] || null;
    const sBus   = nearbyStartBus[0]   || null;

    if (region === 'europe' || region === 'east_asia' || region === 'americas') {
      // Walk + Tram → City Train → Airport express
      if (sTrain) {
        const walkDist   = Math.min(0.4, sTrain.distance);
        const tramDist   = Math.max(0.3, sTrain.distance - walkDist);
        const trainToApt = Math.max(1,   aptDist - sTrain.distance);
        originOpts.push({
          label: 'Walk + Tram + Train',
          legs: [
            { mode: 'walking', from: startName,         to: 'Tram / Bus Stop',  distanceKm: walkDist.toFixed(2),   cost: 0,                                  durationMins: duration('walking', walkDist) },
            { mode: 'tram',    from: 'Tram / Bus Stop', to: sTrain.name,        distanceKm: tramDist.toFixed(2),   cost: cost('tram', tramDist, region),      durationMins: duration('tram', tramDist),   waitMinutes: 5, frequency: 10, nextScheduled: estimatedSchedule('metro', fromDate).next },
            { mode: 'train',   from: sTrain.name,       to: startAptName,       distanceKm: trainToApt.toFixed(2), cost: cost('train', trainToApt, region),   durationMins: duration('train', trainToApt), waitMinutes: 10, frequency: 30, boardingStop: sTrain.name, alightingStop: startAptName, note: 'Airport express / regional train' },
          ],
        });
        // Bicycle → park at station → Train to airport (Europe only)
        if (region === 'europe') {
          const bikeDist   = Math.max(0.5, sTrain.distance);
          const trainToApt2 = Math.max(1, aptDist - sTrain.distance);
          originOpts.push({
            label: 'Bicycle + Train',
            legs: [
              { mode: 'car_bike', from: startName,  to: `${sTrain.name} (Bike Park)`, distanceKm: bikeDist.toFixed(2),    cost: 0, durationMins: duration('car_bike', bikeDist), note: 'Park bicycle at station bike parking (Fahrradstellplatz)' },
              { mode: 'train',    from: sTrain.name, to: startAptName,                distanceKm: trainToApt2.toFixed(2), cost: cost('train', trainToApt2, region), durationMins: duration('train', trainToApt2), waitMinutes: 10, frequency: 30, boardingStop: sTrain.name, alightingStop: startAptName, note: 'Airport express / regional train' },
            ],
          });
        }
      } else if (sMetro) {
        const walkDist   = Math.min(0.5, sMetro.distance);
        const metroToApt = Math.max(1, aptDist - walkDist);
        originOpts.push({
          label: 'Walk + Metro',
          legs: [
            { mode: 'walking', from: startName,    to: sMetro.name,  distanceKm: walkDist.toFixed(2),   cost: 0,                                  durationMins: duration('walking', walkDist) },
            { mode: 'metro',   from: sMetro.name,  to: startAptName, distanceKm: metroToApt.toFixed(2), cost: cost('metro', metroToApt, region),   durationMins: duration('metro', metroToApt), waitMinutes: 4, frequency: 5, boardingStop: sMetro.name, alightingStop: startAptName, nextScheduled: estimatedSchedule('metro', fromDate).next, note: 'Metro / subway to airport' },
          ],
        });
      } else if (sBus) {
        const walkDist  = Math.min(0.4, sBus.distance);
        const busToApt  = Math.max(1, aptDist - walkDist);
        originOpts.push({
          label: 'Walk + Bus',
          legs: [
            { mode: 'walking', from: startName,   to: sBus.name,    distanceKm: walkDist.toFixed(2), cost: 0,                                durationMins: duration('walking', walkDist) },
            { mode: 'bus',     from: sBus.name,   to: startAptName, distanceKm: busToApt.toFixed(2), cost: cost('bus', busToApt, region),    durationMins: duration('bus', busToApt), waitMinutes: 10, frequency: 20, boardingStop: sBus.name, alightingStop: startAptName, note: 'Airport bus / shuttle' },
          ],
        });
      }
    } else if (region === 'south_asia' || region === 'southeast_asia') {
      if (sMetro) {
        const autoDist   = Math.min(3, sMetro.distance);
        const metroToApt = Math.max(1, aptDist - autoDist);
        originOpts.push({
          label: `${autoName} + Metro`,
          legs: [
            { mode: 'auto',  from: startName,   to: sMetro.name,  distanceKm: autoDist.toFixed(2),   cost: cost('auto', autoDist, region),    durationMins: duration('auto', autoDist) },
            { mode: 'metro', from: sMetro.name, to: startAptName, distanceKm: metroToApt.toFixed(2), cost: cost('metro', metroToApt, region),  durationMins: duration('metro', metroToApt), waitMinutes: 4, frequency: 5, boardingStop: sMetro.name, alightingStop: startAptName, nextScheduled: estimatedSchedule('metro', fromDate).next },
          ],
        });
      } else if (sBus) {
        const autoDist  = Math.min(2, sBus.distance);
        const busToApt  = Math.max(1, aptDist - autoDist);
        originOpts.push({
          label: `${autoName} + Bus`,
          legs: [
            { mode: 'auto', from: startName, to: sBus.name,    distanceKm: autoDist.toFixed(2), cost: cost('auto', autoDist, region),   durationMins: duration('auto', autoDist) },
            { mode: 'bus',  from: sBus.name, to: startAptName, distanceKm: busToApt.toFixed(2), cost: cost('bus', busToApt, region),    durationMins: duration('bus', busToApt), waitMinutes: 10, frequency: 20, boardingStop: sBus.name, alightingStop: startAptName, note: 'Airport bus' },
          ],
        });
      }
    }
    // Taxi direct to airport — always an option
    originOpts.push({
      label: 'Taxi to Airport',
      legs: [
        { mode: 'taxi', from: startName, to: startAptName, distanceKm: aptDist.toFixed(2), cost: cost('taxi', aptDist, region), durationMins: duration('taxi', aptDist) },
      ],
    });

    // ── Build airport → destination options ────────────────────────────────
    const destOpts = [];
    const eTrain = nearbyEndTrain[0] || null;
    const eMetro = nearbyEndMetro[0] || null;
    const eBus   = nearbyEndBus[0]   || null;

    // Airport train → local auto/taxi
    if (eTrain) {
      const trainDist = Math.max(1, endAptDist - eTrain.distance);
      const lastDist  = eTrain.distance;
      destOpts.push({
        label: `Train + ${endShowAuto ? autoName : 'Taxi'}`,
        legs: [
          { mode: 'train',        from: endAptName,  to: eTrain.name, distanceKm: trainDist.toFixed(2), cost: cost('train', trainDist, endRegion),        durationMins: duration('train', trainDist), waitMinutes: 15, frequency: 60, boardingStop: endAptName, alightingStop: eTrain.name, note: 'Airport express / regional train to city' },
          { mode: endConnectMode, from: eTrain.name,  to: endName,     distanceKm: lastDist.toFixed(2),  cost: cost(endConnectMode, lastDist, endRegion),  durationMins: duration(endConnectMode, lastDist) },
        ],
      });
    }
    // Metro → auto/taxi
    if (eMetro) {
      const metroDist = Math.max(1, endAptDist - eMetro.distance);
      const lastDist  = eMetro.distance;
      destOpts.push({
        label: `Metro + ${endShowAuto ? autoName : 'Taxi'}`,
        legs: [
          { mode: 'metro',        from: endAptName,  to: eMetro.name, distanceKm: metroDist.toFixed(2), cost: cost('metro', metroDist, endRegion),        durationMins: duration('metro', metroDist), waitMinutes: 4, frequency: 5, boardingStop: endAptName, alightingStop: eMetro.name, nextScheduled: estimatedSchedule('metro', fromDate).next },
          { mode: endConnectMode, from: eMetro.name,  to: endName,     distanceKm: lastDist.toFixed(2),  cost: cost(endConnectMode, lastDist, endRegion),  durationMins: duration(endConnectMode, lastDist) },
        ],
      });
    }
    // Airport bus → auto/taxi
    if (eBus) {
      const busDist  = Math.max(1, endAptDist - eBus.distance);
      const lastDist = eBus.distance;
      destOpts.push({
        label: `Bus + ${endShowAuto ? autoName : 'Taxi'}`,
        legs: [
          { mode: 'bus',          from: endAptName, to: eBus.name, distanceKm: busDist.toFixed(2),  cost: cost('bus', busDist, endRegion),           durationMins: duration('bus', busDist),  waitMinutes: 15, frequency: 30, boardingStop: endAptName, alightingStop: eBus.name, note: 'Airport bus to city centre' },
          { mode: endConnectMode, from: eBus.name,  to: endName,   distanceKm: lastDist.toFixed(2), cost: cost(endConnectMode, lastDist, endRegion),  durationMins: duration(endConnectMode, lastDist) },
        ],
      });
    }
    // Taxi direct from airport — always available
    destOpts.push({
      label: 'Taxi from Airport',
      legs: [
        { mode: 'taxi', from: endAptName, to: endName, distanceKm: endAptDist.toFixed(2), cost: cost('taxi', endAptDist, endRegion), durationMins: duration('taxi', endAptDist) },
      ],
    });

    // ── Combine origin + flight + destination variants (cap at 4 routes) ───
    const flightRoutes = [];
    for (const orig of originOpts) {
      for (const dest of destOpts) {
        const allLegs = [...orig.legs, flightLeg, ...dest.legs];
        const totals  = legsTotals(allLegs);
        flightRoutes.push({
          case: 5,
          label: `Flight (${orig.label} → ${dest.label})`,
          legs: allLegs,
          ...totals,
          totalDistanceKm: totalDist.toFixed(2),
        });
      }
    }
    flightRoutes.sort((a, b) => a.totalDurationMins - b.totalDurationMins);
    routes.push(...flightRoutes.slice(0, 4));
  }

  // ── Direct motor options — only for road-feasible distances ──────────────
  // Auto/Rickshaw: max 80 km (city/intercity only)
  // Taxi: max 500 km (intercity road trip)
  // Car/Bike: max 1500 km (cross-country, but not intercontinental)
  const MOTOR_MAX = { auto: 80, taxi: 500, car_bike: 1500 };

  if (showAuto && totalDist <= MOTOR_MAX.auto) {
    routes.push({
      case: 0, label: `Direct ${autoName}`,
      legs: [{ mode: 'auto', from: startName, to: endName, distanceKm: totalDist.toFixed(2), cost: cost('auto', totalDist, region), durationMins: duration('auto', totalDist) }],
      totalCost: cost('auto', totalDist, region), totalDurationMins: duration('auto', totalDist), totalDistanceKm: totalDist.toFixed(2),
    });
  }
  if (totalDist <= MOTOR_MAX.taxi) {
    routes.push({
      case: 0, label: 'Taxi / Cab',
      legs: [{ mode: 'taxi', from: startName, to: endName, distanceKm: totalDist.toFixed(2), cost: cost('taxi', totalDist, region), durationMins: duration('taxi', totalDist) }],
      totalCost: cost('taxi', totalDist, region), totalDurationMins: duration('taxi', totalDist), totalDistanceKm: totalDist.toFixed(2),
    });
  }
  if (totalDist <= MOTOR_MAX.car_bike) {
    routes.push({
      case: 0, label: 'Car / Bike',
      legs: [{ mode: 'car_bike', from: startName, to: endName, distanceKm: totalDist.toFixed(2), cost: cost('car_bike', totalDist, region), durationMins: duration('car_bike', totalDist) }],
      totalCost: cost('car_bike', totalDist, region), totalDurationMins: duration('car_bike', totalDist), totalDistanceKm: totalDist.toFixed(2),
    });
  }
  if (totalDist <= 5) {
    routes.push({
      case: 0, label: 'Walk',
      legs: [{ mode: 'walking', from: startName, to: endName, distanceKm: totalDist.toFixed(2), cost: 0, durationMins: duration('walking', totalDist) }],
      totalCost: 0, totalDurationMins: duration('walking', totalDist), totalDistanceKm: totalDist.toFixed(2),
    });
  }

  // De-duplicate by label (keep first / lowest cost per label)
  const seen = new Map();
  for (const r of routes) {
    if (!seen.has(r.label)) seen.set(r.label, r);
  }
  let deduped = Array.from(seen.values());

  // Sort: preferred modes float to top, then by duration
  const PREF_MAP = { walking: ['walking'], taxi: ['taxi'], auto: ['auto'], metro: ['metro', 'tram'], train: ['train'], ferry: ['ferry'], air: ['air'] };
  function routeMatchesPref(r, prefModes) {
    const legModes = r.legs.map(l => l.mode);
    return prefModes.some(p => (PREF_MAP[p] || [p]).some(m => legModes.includes(m)));
  }

  if (preferredModes && preferredModes.length > 0) {
    deduped.sort((a, b) => {
      const aPref = routeMatchesPref(a, preferredModes) ? 0 : 1;
      const bPref = routeMatchesPref(b, preferredModes) ? 0 : 1;
      if (aPref !== bPref) return aPref - bPref;
      return a.totalDurationMins - b.totalDurationMins;
    });
  } else {
    deduped.sort((a, b) => a.totalDurationMins - b.totalDurationMins);
  }

  const currency    = regionCurrency(region);
  const endCurrency = regionCurrency(endRegion);
  const mixedCurrency = currency.symbol !== endCurrency.symbol;

  // Tag every leg and route with currency — self-contained so UI never needs a prop chain
  for (const route of deduped) {
    let passedFlight = false;
    let originCost = 0, destCost = 0;
    for (const leg of route.legs) {
      if (leg.mode === 'air') {
        passedFlight = true;
        leg.currencySymbol = currency.symbol;
        originCost += leg.cost || 0;
      } else if (passedFlight && mixedCurrency) {
        leg.currencySymbol = endCurrency.symbol;
        destCost += leg.cost || 0;
      } else {
        leg.currencySymbol = currency.symbol;
        originCost += leg.cost || 0;
      }
    }
    route.currencySymbol = currency.symbol;
    if (mixedCurrency) {
      route.originCost           = Math.round(originCost * 100) / 100;
      route.destCost             = Math.round(destCost * 100) / 100;
      route.originCurrencySymbol = currency.symbol;
      route.destCurrencySymbol   = endCurrency.symbol;
      route.totalCost            = route.originCost;
    } else {
      route.totalCost = Math.round((originCost + destCost) * 100) / 100;
    }
  }

  return {
    startName, endName,
    totalDistanceKm: totalDist.toFixed(2),
    isIntercontinental,
    currencySymbol: currency.symbol,
    currencyCode: currency.code,
    endCurrencySymbol: endCurrency.symbol,
    endCurrencyCode: endCurrency.code,
    mixedCurrency,
    nearbyTransport: {
      busStops: nearbyStartBus,
      metroStations: nearbyStartMetro,
      trainStations: nearbyStartTrain,
      ferryTerminals: nearbyStartFerry,
      airports: nearbyStartAir,
    },
    routes: deduped,
  };
}

module.exports = { planJourney, getNearbyBusStops, getNearbyMetroStations, distanceKm, regionalFareMultiplier };

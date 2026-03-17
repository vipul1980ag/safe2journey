/**
 * Seeds the local DB with Delhi NCR transport data.
 * For locations outside Delhi, the app automatically fetches
 * worldwide real-time data from OpenStreetMap Overpass API.
 *
 * Run: node server/db/seed.js
 */
const db = require('./database');

['bus_stops', 'metro_stations', 'bus_schedules', 'metro_schedules'].forEach(t => db.clear(t));

// ── Delhi Bus Stops ───────────────────────────────────────────────────────────
const busStops = [
  // Central Delhi
  { name: 'Connaught Place Bus Stop',        route_id: '574',  lat: 28.6315, lng: 77.2167 },
  { name: 'Rajiv Chowk Bus Stop',            route_id: '259',  lat: 28.6329, lng: 77.2195 },
  { name: 'India Gate Bus Stop',             route_id: '423',  lat: 28.6129, lng: 77.2295 },
  { name: 'Mandi House Bus Stop',            route_id: '303',  lat: 28.6270, lng: 77.2290 },
  { name: 'Barakhamba Road Bus Stop',        route_id: '180',  lat: 28.6295, lng: 77.2237 },
  { name: 'ITO Bus Stop',                    route_id: '441',  lat: 28.6277, lng: 77.2406 },
  { name: 'Delhi Gate Bus Stop',             route_id: '590',  lat: 28.6406, lng: 77.2376 },
  { name: 'Daryaganj Bus Stop',              route_id: '147',  lat: 28.6499, lng: 77.2365 },
  { name: 'Kashmere Gate ISBT',              route_id: '01',   lat: 28.6675, lng: 77.2282 },

  // North Delhi
  { name: 'Karol Bagh Bus Stop',             route_id: '107',  lat: 28.6514, lng: 77.1907 },
  { name: 'Rohini Bus Stop',                 route_id: '820',  lat: 28.7374, lng: 77.1130 },
  { name: 'Pitampura Bus Stop',              route_id: '711',  lat: 28.7005, lng: 77.1305 },
  { name: 'Netaji Subhash Place Bus Stop',   route_id: '760',  lat: 28.6952, lng: 77.1494 },
  { name: 'Azadpur Bus Stop',               route_id: '533',  lat: 28.7072, lng: 77.1793 },
  { name: 'Model Town Bus Stop',             route_id: '444',  lat: 28.7177, lng: 77.1942 },
  { name: 'GTB Nagar Bus Stop',              route_id: '355',  lat: 28.6960, lng: 77.2076 },
  { name: 'Mukherjee Nagar Bus Stop',        route_id: '322',  lat: 28.7107, lng: 77.2094 },
  { name: 'Civil Lines Bus Stop',            route_id: '290',  lat: 28.6740, lng: 77.2252 },

  // South Delhi
  { name: 'Lajpat Nagar Bus Stop',           route_id: '318',  lat: 28.5677, lng: 77.2434 },
  { name: 'Saket Bus Stop',                  route_id: '512',  lat: 28.5245, lng: 77.2066 },
  { name: 'Hauz Khas Bus Stop',             route_id: '601',  lat: 28.5433, lng: 77.2066 },
  { name: 'Greater Kailash Bus Stop',        route_id: '453',  lat: 28.5375, lng: 77.2380 },
  { name: 'Nehru Place Bus Stop',            route_id: '511',  lat: 28.5489, lng: 77.2511 },
  { name: 'Kalkaji Bus Stop',               route_id: '384',  lat: 28.5432, lng: 77.2580 },
  { name: 'Vasant Kunj Bus Stop',            route_id: '664',  lat: 28.5205, lng: 77.1540 },
  { name: 'Vasant Vihar Bus Stop',           route_id: '552',  lat: 28.5590, lng: 77.1625 },
  { name: 'Mehrauli Bus Stop',              route_id: '607',  lat: 28.5244, lng: 77.1866 },
  { name: 'Malviya Nagar Bus Stop',          route_id: '429',  lat: 28.5372, lng: 77.2019 },
  { name: 'Sarai Kale Khan ISBT',           route_id: '02',   lat: 28.5899, lng: 77.2607 },

  // West Delhi
  { name: 'Dwarka Bus Stop',                 route_id: '710',  lat: 28.5921, lng: 77.0460 },
  { name: 'Janakpuri Bus Stop',              route_id: '722',  lat: 28.6215, lng: 77.0836 },
  { name: 'Uttam Nagar Bus Stop',            route_id: '788',  lat: 28.6202, lng: 77.0586 },
  { name: 'Tilak Nagar Bus Stop',            route_id: '735',  lat: 28.6388, lng: 77.0951 },
  { name: 'Rajouri Garden Bus Stop',         route_id: '740',  lat: 28.6469, lng: 77.1205 },
  { name: 'Patel Nagar Bus Stop',            route_id: '714',  lat: 28.6528, lng: 77.1674 },

  // East Delhi
  { name: 'Laxmi Nagar Bus Stop',            route_id: '840',  lat: 28.6340, lng: 77.2765 },
  { name: 'Preet Vihar Bus Stop',            route_id: '855',  lat: 28.6428, lng: 77.2936 },
  { name: 'Anand Vihar Bus Stop',            route_id: '870',  lat: 28.6469, lng: 77.3158 },
  { name: 'Dilshad Garden Bus Stop',         route_id: '885',  lat: 28.6778, lng: 77.3175 },
  { name: 'Shahdara Bus Stop',              route_id: '895',  lat: 28.6678, lng: 77.2879 },

  // NCR
  { name: 'Noida Sector 18 Bus Stop',        route_id: '930',  lat: 28.5694, lng: 77.3210 },
  { name: 'Noida Sector 62 Bus Stop',        route_id: '945',  lat: 28.6270, lng: 77.3723 },
  { name: 'Gurgaon Bus Stop',                route_id: '150',  lat: 28.4595, lng: 77.0266 },
  { name: 'Gurgaon Cyber City Bus Stop',     route_id: '162',  lat: 28.4950, lng: 77.0892 },
  { name: 'Faridabad Bus Stop',              route_id: '210',  lat: 28.4089, lng: 77.3178 },
  { name: 'Ghaziabad Bus Stop',              route_id: '920',  lat: 28.6692, lng: 77.4538 },
];

// ── Delhi Metro Stations (all operational lines) ──────────────────────────────
const metroStations = [
  // Yellow Line (Samaypur Badli ↔ HUDA City Centre)
  { name: 'Samaypur Badli',        line: 'Yellow Line', lat: 28.7481, lng: 77.1355 },
  { name: 'Rohini Sector 18,19',   line: 'Yellow Line', lat: 28.7410, lng: 77.1270 },
  { name: 'Haiderpur Badli Mor',   line: 'Yellow Line', lat: 28.7329, lng: 77.1424 },
  { name: 'Jahangirpuri',          line: 'Yellow Line', lat: 28.7239, lng: 77.1636 },
  { name: 'Adarsh Nagar',         line: 'Yellow Line', lat: 28.7174, lng: 77.1784 },
  { name: 'Azadpur',              line: 'Yellow Line', lat: 28.7104, lng: 77.1803 },
  { name: 'Model Town',            line: 'Yellow Line', lat: 28.7030, lng: 77.1890 },
  { name: 'GTB Nagar',             line: 'Yellow Line', lat: 28.6960, lng: 77.2076 },
  { name: 'Vishwavidyalaya',       line: 'Yellow Line', lat: 28.6887, lng: 77.2097 },
  { name: 'Vidhan Sabha',          line: 'Yellow Line', lat: 28.6799, lng: 77.2133 },
  { name: 'Civil Lines',           line: 'Yellow Line', lat: 28.6740, lng: 77.2252 },
  { name: 'Kashmere Gate',         line: 'Yellow Line', lat: 28.6677, lng: 77.2285 },
  { name: 'Chandni Chowk',        line: 'Yellow Line', lat: 28.6586, lng: 77.2310 },
  { name: 'Chawri Bazar',         line: 'Yellow Line', lat: 28.6498, lng: 77.2285 },
  { name: 'New Delhi',             line: 'Yellow Line', lat: 28.6422, lng: 77.2200 },
  { name: 'Rajiv Chowk',          line: 'Yellow Line', lat: 28.6331, lng: 77.2195 },
  { name: 'Patel Chowk',          line: 'Yellow Line', lat: 28.6256, lng: 77.2118 },
  { name: 'Central Secretariat',  line: 'Yellow Line', lat: 28.6150, lng: 77.2090 },
  { name: 'Udyog Bhawan',         line: 'Yellow Line', lat: 28.6087, lng: 77.2108 },
  { name: 'Lok Kalyan Marg',      line: 'Yellow Line', lat: 28.6006, lng: 77.2102 },
  { name: 'Jorbagh',              line: 'Yellow Line', lat: 28.5897, lng: 77.2053 },
  { name: 'INA',                  line: 'Yellow Line', lat: 28.5747, lng: 77.2072 },
  { name: 'AIIMS',                line: 'Yellow Line', lat: 28.5678, lng: 77.2072 },
  { name: 'Green Park',           line: 'Yellow Line', lat: 28.5598, lng: 77.2063 },
  { name: 'Hauz Khas',            line: 'Yellow Line', lat: 28.5433, lng: 77.2066 },
  { name: 'Malviya Nagar',        line: 'Yellow Line', lat: 28.5303, lng: 77.2078 },
  { name: 'Saket',                line: 'Yellow Line', lat: 28.5247, lng: 77.2064 },
  { name: 'Qutab Minar',         line: 'Yellow Line', lat: 28.5130, lng: 77.1856 },
  { name: 'Chhatarpur',           line: 'Yellow Line', lat: 28.4997, lng: 77.1690 },
  { name: 'Sultanpur',            line: 'Yellow Line', lat: 28.4921, lng: 77.1561 },
  { name: 'Ghitorni',             line: 'Yellow Line', lat: 28.4816, lng: 77.1413 },
  { name: 'Arjan Garh',          line: 'Yellow Line', lat: 28.4714, lng: 77.1282 },
  { name: 'Guru Dronacharya',    line: 'Yellow Line', lat: 28.4665, lng: 77.1039 },
  { name: 'Sikanderpur',         line: 'Yellow Line', lat: 28.4614, lng: 77.0959 },
  { name: 'MG Road',             line: 'Yellow Line', lat: 28.4697, lng: 77.0874 },
  { name: 'IFFCO Chowk',         line: 'Yellow Line', lat: 28.4750, lng: 77.0771 },
  { name: 'HUDA City Centre',    line: 'Yellow Line', lat: 28.4595, lng: 77.0266 },

  // Blue Line (Dwarka Sector 21 ↔ Vaishali/Noida)
  { name: 'Dwarka Sector 21',    line: 'Blue Line',   lat: 28.5527, lng: 77.0588 },
  { name: 'Dwarka Sector 8',     line: 'Blue Line',   lat: 28.5695, lng: 77.0644 },
  { name: 'Dwarka Sector 9',     line: 'Blue Line',   lat: 28.5804, lng: 77.0697 },
  { name: 'Dwarka Sector 10',    line: 'Blue Line',   lat: 28.5878, lng: 77.0716 },
  { name: 'Dwarka Sector 11',    line: 'Blue Line',   lat: 28.5958, lng: 77.0745 },
  { name: 'Dwarka Sector 12',    line: 'Blue Line',   lat: 28.6013, lng: 77.0807 },
  { name: 'Dwarka Sector 13',    line: 'Blue Line',   lat: 28.6061, lng: 77.0876 },
  { name: 'Dwarka Sector 14',    line: 'Blue Line',   lat: 28.6102, lng: 77.0960 },
  { name: 'Dwarka',              line: 'Blue Line',   lat: 28.6135, lng: 77.1074 },
  { name: 'Dwarka Mor',          line: 'Blue Line',   lat: 28.6175, lng: 77.1163 },
  { name: 'Nawada',              line: 'Blue Line',   lat: 28.6209, lng: 77.1287 },
  { name: 'Uttam Nagar West',    line: 'Blue Line',   lat: 28.6211, lng: 77.1402 },
  { name: 'Uttam Nagar East',    line: 'Blue Line',   lat: 28.6211, lng: 77.1523 },
  { name: 'Janakpuri West',      line: 'Blue Line',   lat: 28.6215, lng: 77.0836 },
  { name: 'Janakpuri East',      line: 'Blue Line',   lat: 28.6332, lng: 77.0943 },
  { name: 'Tilak Nagar',         line: 'Blue Line',   lat: 28.6388, lng: 77.0951 },
  { name: 'Subhash Nagar',       line: 'Blue Line',   lat: 28.6434, lng: 77.1059 },
  { name: 'Tagore Garden',       line: 'Blue Line',   lat: 28.6468, lng: 77.1136 },
  { name: 'Rajouri Garden',      line: 'Blue Line',   lat: 28.6469, lng: 77.1205 },
  { name: 'Ramesh Nagar',        line: 'Blue Line',   lat: 28.6479, lng: 77.1326 },
  { name: 'Moti Nagar',          line: 'Blue Line',   lat: 28.6473, lng: 77.1476 },
  { name: 'Kirti Nagar',         line: 'Blue Line',   lat: 28.6470, lng: 77.1602 },
  { name: 'Shadipur',            line: 'Blue Line',   lat: 28.6483, lng: 77.1718 },
  { name: 'Patel Nagar',         line: 'Blue Line',   lat: 28.6528, lng: 77.1674 },
  { name: 'Rajendra Place',      line: 'Blue Line',   lat: 28.6555, lng: 77.1826 },
  { name: 'Karol Bagh',          line: 'Blue Line',   lat: 28.6514, lng: 77.1907 },
  { name: 'Jhandewalan',         line: 'Blue Line',   lat: 28.6482, lng: 77.1989 },
  { name: 'Ramakrishna Ashram Marg', line: 'Blue Line', lat: 28.6426, lng: 77.2093 },
  { name: 'Rajiv Chowk (Blue)', line: 'Blue Line',   lat: 28.6331, lng: 77.2195 },
  { name: 'Barakhamba Road',     line: 'Blue Line',   lat: 28.6295, lng: 77.2237 },
  { name: 'Mandi House',         line: 'Blue Line',   lat: 28.6270, lng: 77.2290 },
  { name: 'Pragati Maidan',      line: 'Blue Line',   lat: 28.6221, lng: 77.2446 },
  { name: 'Indraprastha',        line: 'Blue Line',   lat: 28.6139, lng: 77.2549 },
  { name: 'Yamuna Bank',         line: 'Blue Line',   lat: 28.6135, lng: 77.2722 },
  { name: 'Akshardham',          line: 'Blue Line',   lat: 28.6124, lng: 77.2778 },
  { name: 'Mayur Vihar Phase 1', line: 'Blue Line',   lat: 28.6089, lng: 77.2948 },
  { name: 'Mayur Vihar Extension', line: 'Blue Line', lat: 28.6082, lng: 77.3077 },
  { name: 'New Ashok Nagar',     line: 'Blue Line',   lat: 28.6078, lng: 77.3151 },
  { name: 'Noida Sector 15',     line: 'Blue Line',   lat: 28.5922, lng: 77.3266 },
  { name: 'Noida Sector 16',     line: 'Blue Line',   lat: 28.5844, lng: 77.3315 },
  { name: 'Noida Sector 18',     line: 'Blue Line',   lat: 28.5694, lng: 77.3210 },
  { name: 'Botanical Garden',    line: 'Blue Line',   lat: 28.5591, lng: 77.3370 },
  { name: 'Noida City Centre',   line: 'Blue Line',   lat: 28.5733, lng: 77.3220 },
  { name: 'Anand Vihar',         line: 'Blue Line',   lat: 28.6469, lng: 77.3158 },
  { name: 'Kaushambi',           line: 'Blue Line',   lat: 28.6455, lng: 77.3256 },
  { name: 'Vaishali',            line: 'Blue Line',   lat: 28.6449, lng: 77.3375 },

  // Red Line (Rithala ↔ Dilshad Garden)
  { name: 'Rithala',             line: 'Red Line',    lat: 28.7228, lng: 77.1065 },
  { name: 'Rohini West',         line: 'Red Line',    lat: 28.7168, lng: 77.1141 },
  { name: 'Rohini East',         line: 'Red Line',    lat: 28.7100, lng: 77.1257 },
  { name: 'Pitampura',           line: 'Red Line',    lat: 28.7005, lng: 77.1305 },
  { name: 'Kohat Enclave',       line: 'Red Line',    lat: 28.6982, lng: 77.1393 },
  { name: 'Netaji Subhash Place',line: 'Red Line',    lat: 28.6952, lng: 77.1494 },
  { name: 'Keshav Puram',        line: 'Red Line',    lat: 28.6894, lng: 77.1609 },
  { name: 'Kanhaiya Nagar',      line: 'Red Line',    lat: 28.6844, lng: 77.1711 },
  { name: 'Inderlok',            line: 'Red Line',    lat: 28.6681, lng: 77.1698 },
  { name: 'Shastri Nagar',       line: 'Red Line',    lat: 28.6634, lng: 77.1823 },
  { name: 'Pratap Nagar',        line: 'Red Line',    lat: 28.6649, lng: 77.1983 },
  { name: 'Pulbangash',          line: 'Red Line',    lat: 28.6627, lng: 77.2153 },
  { name: 'Tis Hazari',          line: 'Red Line',    lat: 28.6657, lng: 77.2266 },
  { name: 'Kashmere Gate (Red)', line: 'Red Line',    lat: 28.6677, lng: 77.2285 },
  { name: 'Lal Qila',            line: 'Red Line',    lat: 28.6553, lng: 77.2413 },
  { name: 'Jama Masjid',         line: 'Red Line',    lat: 28.6500, lng: 77.2414 },
  { name: 'Delhi Gate',          line: 'Red Line',    lat: 28.6406, lng: 77.2376 },
  { name: 'ITO',                 line: 'Red Line',    lat: 28.6277, lng: 77.2406 },
  { name: 'Shivaji Stadium',     line: 'Red Line',    lat: 28.6310, lng: 77.2121 },
  { name: 'Shahdara',            line: 'Red Line',    lat: 28.6678, lng: 77.2879 },
  { name: 'Welcome',             line: 'Red Line',    lat: 28.6747, lng: 77.2996 },
  { name: 'Seelampur',           line: 'Red Line',    lat: 28.6743, lng: 77.3040 },
  { name: 'Shastri Park',        line: 'Red Line',    lat: 28.6681, lng: 77.3096 },
  { name: 'Dilshad Garden',      line: 'Red Line',    lat: 28.6778, lng: 77.3175 },

  // Pink Line (Majlis Park ↔ Shiv Vihar)
  { name: 'Majlis Park',         line: 'Pink Line',   lat: 28.7246, lng: 77.1603 },
  { name: 'Azadpur (Pink)',      line: 'Pink Line',   lat: 28.7104, lng: 77.1803 },
  { name: 'Shalimar Bagh',       line: 'Pink Line',   lat: 28.7033, lng: 77.1621 },
  { name: 'Shakurpur',           line: 'Pink Line',   lat: 28.6916, lng: 77.1384 },
  { name: 'Punjabi Bagh West',   line: 'Pink Line',   lat: 28.6721, lng: 77.1285 },
  { name: 'ESI Hospital',        line: 'Pink Line',   lat: 28.6675, lng: 77.1388 },
  { name: 'Rajouri Garden (Pink)', line: 'Pink Line', lat: 28.6469, lng: 77.1205 },
  { name: 'Madipur',             line: 'Pink Line',   lat: 28.6461, lng: 77.1342 },
  { name: 'Paschim Vihar East',  line: 'Pink Line',   lat: 28.6671, lng: 77.1006 },
  { name: 'Paschim Vihar West',  line: 'Pink Line',   lat: 28.6700, lng: 77.0901 },
  { name: 'Peera Garhi',         line: 'Pink Line',   lat: 28.6694, lng: 77.0777 },
  { name: 'Udyog Nagar',         line: 'Pink Line',   lat: 28.6626, lng: 77.0687 },
  { name: 'Dashrathpuri',        line: 'Pink Line',   lat: 28.6491, lng: 77.0629 },
  { name: 'Palam',               line: 'Pink Line',   lat: 28.5943, lng: 77.0829 },
  { name: 'Lajpat Nagar (Pink)', line: 'Pink Line',   lat: 28.5673, lng: 77.2435 },
  { name: 'Vinobapuri',          line: 'Pink Line',   lat: 28.5700, lng: 77.2520 },
  { name: 'Ashram',              line: 'Pink Line',   lat: 28.5748, lng: 77.2615 },
  { name: 'Hazrat Nizamuddin',   line: 'Pink Line',   lat: 28.5866, lng: 77.2508 },
  { name: 'Mayur Vihar Ph-1 (Pink)', line: 'Pink Line', lat: 28.6089, lng: 77.2948 },
  { name: 'IP Extension',        line: 'Pink Line',   lat: 28.6311, lng: 77.3013 },
  { name: 'Anand Vihar (Pink)',  line: 'Pink Line',   lat: 28.6469, lng: 77.3158 },
  { name: 'Karkarduma',          line: 'Pink Line',   lat: 28.6523, lng: 77.3081 },
  { name: 'Shiv Vihar',          line: 'Pink Line',   lat: 28.6967, lng: 77.3482 },

  // Magenta Line (Janakpuri West ↔ Botanical Garden)
  { name: 'Janakpuri West (Magenta)', line: 'Magenta Line', lat: 28.6215, lng: 77.0836 },
  { name: 'Dabri Mor',           line: 'Magenta Line', lat: 28.6078, lng: 77.0868 },
  { name: 'Dashrathpuri (Mag)', line: 'Magenta Line', lat: 28.5982, lng: 77.0893 },
  { name: 'Palam (Magenta)',     line: 'Magenta Line', lat: 28.5943, lng: 77.0829 },
  { name: 'Sadar Bazaar Cantonment', line: 'Magenta Line', lat: 28.5795, lng: 77.0977 },
  { name: 'IGI Airport T1',      line: 'Magenta Line', lat: 28.5562, lng: 77.0890 },
  { name: 'Shankar Vihar',       line: 'Magenta Line', lat: 28.5509, lng: 77.1090 },
  { name: 'Vasant Vihar (Mag)', line: 'Magenta Line', lat: 28.5590, lng: 77.1625 },
  { name: 'Munirka',             line: 'Magenta Line', lat: 28.5557, lng: 77.1742 },
  { name: 'R K Puram',           line: 'Magenta Line', lat: 28.5635, lng: 77.1825 },
  { name: 'IIT Delhi',           line: 'Magenta Line', lat: 28.5459, lng: 77.1927 },
  { name: 'Hauz Khas (Magenta)', line: 'Magenta Line', lat: 28.5433, lng: 77.2066 },
  { name: 'Panchsheel Park',     line: 'Magenta Line', lat: 28.5317, lng: 77.2127 },
  { name: 'Chirag Delhi',        line: 'Magenta Line', lat: 28.5196, lng: 77.2219 },
  { name: 'Greater Kailash',     line: 'Magenta Line', lat: 28.5375, lng: 77.2380 },
  { name: 'Nehru Enclave',       line: 'Magenta Line', lat: 28.5431, lng: 77.2490 },
  { name: 'Kalkaji Mandir',      line: 'Magenta Line', lat: 28.5432, lng: 77.2580 },
  { name: 'Okhla NSIC',          line: 'Magenta Line', lat: 28.5358, lng: 77.2711 },
  { name: 'Sukhdev Vihar',       line: 'Magenta Line', lat: 28.5426, lng: 77.2842 },
  { name: 'Jamia Millia Islamia',line: 'Magenta Line', lat: 28.5597, lng: 77.2838 },
  { name: 'Okhla Vihar',         line: 'Magenta Line', lat: 28.5691, lng: 77.3016 },
  { name: 'Jasola Vihar Shaheen Bagh', line: 'Magenta Line', lat: 28.5609, lng: 77.3098 },
  { name: 'Kalindi Kunj',        line: 'Magenta Line', lat: 28.5529, lng: 77.3164 },
  { name: 'Okhla Bird Sanctuary',line: 'Magenta Line', lat: 28.5442, lng: 77.3241 },
  { name: 'Botanical Garden (Mag)', line: 'Magenta Line', lat: 28.5591, lng: 77.3370 },

  // Orange Line — Airport Express
  { name: 'New Delhi (Airport)',  line: 'Airport Express', lat: 28.6422, lng: 77.2200 },
  { name: 'Shivaji Stadium (Airport)', line: 'Airport Express', lat: 28.6310, lng: 77.2121 },
  { name: 'Dhaula Kuan',         line: 'Airport Express', lat: 28.5906, lng: 77.1611 },
  { name: 'IGI Airport T3',      line: 'Airport Express', lat: 28.5562, lng: 77.0890 },
  { name: 'Dwarka Sector 21 (Airport)', line: 'Airport Express', lat: 28.5527, lng: 77.0588 },

  // Violet Line (Kashmere Gate ↔ Raja Nahar Singh)
  { name: 'Kashmere Gate (Violet)', line: 'Violet Line', lat: 28.6677, lng: 77.2285 },
  { name: 'Lal Qila (Violet)',   line: 'Violet Line',  lat: 28.6553, lng: 77.2413 },
  { name: 'Jama Masjid (Violet)',line: 'Violet Line',  lat: 28.6500, lng: 77.2414 },
  { name: 'Delhi Gate (Violet)', line: 'Violet Line',  lat: 28.6406, lng: 77.2376 },
  { name: 'ITO (Violet)',        line: 'Violet Line',  lat: 28.6277, lng: 77.2406 },
  { name: 'Janpath',             line: 'Violet Line',  lat: 28.6255, lng: 77.2183 },
  { name: 'Central Secretariat (V)', line: 'Violet Line', lat: 28.6150, lng: 77.2090 },
  { name: 'Khan Market',         line: 'Violet Line',  lat: 28.5999, lng: 77.2278 },
  { name: 'Jawaharlal Nehru Stadium', line: 'Violet Line', lat: 28.5835, lng: 77.2356 },
  { name: 'Jangpura',            line: 'Violet Line',  lat: 28.5777, lng: 77.2424 },
  { name: 'Lajpat Nagar (Violet)', line: 'Violet Line', lat: 28.5673, lng: 77.2435 },
  { name: 'Moolchand',           line: 'Violet Line',  lat: 28.5575, lng: 77.2367 },
  { name: 'Kailash Colony',      line: 'Violet Line',  lat: 28.5494, lng: 77.2379 },
  { name: 'Nehru Place (Violet)',line: 'Violet Line',  lat: 28.5489, lng: 77.2511 },
  { name: 'Kalkaji Mandir (V)',  line: 'Violet Line',  lat: 28.5432, lng: 77.2580 },
  { name: 'Govindpuri',          line: 'Violet Line',  lat: 28.5338, lng: 77.2558 },
  { name: 'Harkesh Nagar Okhla', line: 'Violet Line',  lat: 28.5249, lng: 77.2622 },
  { name: 'Jasola Apollo',       line: 'Violet Line',  lat: 28.5199, lng: 77.2808 },
  { name: 'Sarita Vihar',        line: 'Violet Line',  lat: 28.5127, lng: 77.2919 },
  { name: 'Mohan Estate',        line: 'Violet Line',  lat: 28.5009, lng: 77.3006 },
  { name: 'Tughlakabad',         line: 'Violet Line',  lat: 28.4889, lng: 77.3031 },
  { name: 'Badarpur Border',     line: 'Violet Line',  lat: 28.4754, lng: 77.3109 },
  { name: 'YMCA Chowk Faridabad',line: 'Violet Line',  lat: 28.4620, lng: 77.3150 },
  { name: 'Escorts Mujesar',     line: 'Violet Line',  lat: 28.4490, lng: 77.3190 },
  { name: 'Raja Nahar Singh',    line: 'Violet Line',  lat: 28.4089, lng: 77.3178 },

  // Grey Line (Dwarka ↔ Najafgarh)
  { name: 'Dwarka (Grey)',        line: 'Grey Line',    lat: 28.6135, lng: 77.1074 },
  { name: 'Nangli',              line: 'Grey Line',    lat: 28.5984, lng: 77.0510 },
  { name: 'Najafgarh',           line: 'Grey Line',    lat: 28.6104, lng: 76.9785 },

  // Green Line (Inderlok ↔ Brigadier Hoshiyar Singh)
  { name: 'Inderlok (Green)',    line: 'Green Line',   lat: 28.6681, lng: 77.1698 },
  { name: 'Ashok Park Main',     line: 'Green Line',   lat: 28.6607, lng: 77.1591 },
  { name: 'Satguru Ram Singh Marg', line: 'Green Line', lat: 28.6548, lng: 77.1495 },
  { name: 'Kirti Nagar (Green)',line: 'Green Line',   lat: 28.6470, lng: 77.1602 },
  { name: 'Brigadier Hoshiyar Singh', line: 'Green Line', lat: 28.6784, lng: 77.0715 },
];

// Seed bus stops
busStops.forEach(stop => {
  const row = db.insert('bus_stops', stop);
  db.insert('bus_schedules', { stop_id: row.id, route_id: stop.route_id, departure_time: '05:30', frequency_minutes: 10 });
  db.insert('bus_schedules', { stop_id: row.id, route_id: stop.route_id, departure_time: '06:00', frequency_minutes: 10 });
});

// Seed metro stations
metroStations.forEach(station => {
  const row = db.insert('metro_stations', station);
  db.insert('metro_schedules', {
    station_id: row.id,
    line: station.line,
    first_train: station.line === 'Airport Express' ? '04:45' : '05:30',
    last_train:  station.line === 'Airport Express' ? '23:30' : '23:00',
    frequency_minutes: station.line === 'Airport Express' ? 10 : 3,
  });
});

console.log(`Seeded: ${busStops.length} bus stops, ${metroStations.length} metro stations`);
console.log('Note: For locations outside Delhi NCR, the app fetches worldwide transit data from OpenStreetMap Overpass API in real-time.');

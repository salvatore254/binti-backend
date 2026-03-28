/**
 * TransportService
 * Handles location-to-zone mapping and transport cost calculations
 * Nairobi service area divided into geographic zones with different transport costs
 * Also handles outside Nairobi locations with separate pricing tiers based on distance
 */

// Nairobi zones and their transport costs (KES) - DOUBLED FOR ROUND-TRIP
const NAIROBI_ZONES = {
  'cbd': {
    name: 'CBD/Central',
    cost: 5000,
    areas: ['cbd', 'central business district', 'city center', 'downtown'],
    coordinates: { minLat: -1.295, maxLat: -1.280, minLng: 36.805, maxLng: 36.825 }
  },
  'westlands': {
    name: 'Westlands',
    cost: 6000,
    areas: ['westlands', 'nairobi west', 'upper hill', 'kilimani'],
    coordinates: { minLat: -1.290, maxLat: -1.310, minLng: 36.790, maxLng: 36.810 }
  },
  'karen': {
    name: 'Karen/Langata',
    cost: 6000,
    areas: ['karen', 'langata', 'south c', 'south b', 'ngong'],
    coordinates: { minLat: -1.330, maxLat: -1.380, minLng: 36.760, maxLng: 36.820 }
  },
  'kilimani': {
    name: 'Kilimani/Hurlingham',
    cost: 7000,
    areas: ['kilimani', 'hurlingham', 'lavington', 'muthaiga'],
    coordinates: { minLat: -1.285, maxLat: -1.310, minLng: 36.795, maxLng: 36.825 }
  },
  'southlands': {
    name: 'Southlands',
    cost: 6000,
    areas: ['southlands', 'spring valley', 'nyari', 'kitisuru', 'forest edge'],
    coordinates: { minLat: -1.300, maxLat: -1.330, minLng: 36.780, maxLng: 36.810 }
  },
  'eastlands': {
    name: 'Eastlands/Industrial',
    cost: 7000,
    areas: ['eastlands', 'industrial area', 'juja road', 'mlolongo', 'embakasi'],
    coordinates: { minLat: -1.295, maxLat: -1.340, minLng: 36.825, maxLng: 36.880 }
  },
  'northlands': {
    name: 'Northlands/Parklands',
    cost: 6000,
    areas: ['northlands', 'parklands', 'karura', 'ridgeways', 'gigiri', 'runda'],
    coordinates: { minLat: -1.270, maxLat: -1.295, minLng: 36.800, maxLng: 36.850 }
  },
  'kasarani': {
    name: 'Kasarani/Mirema',
    cost: 7000,
    areas: ['kasarani', 'mirema', 'savannah', 'high rise'],
    coordinates: { minLat: -1.260, maxLat: -1.285, minLng: 36.850, maxLng: 36.890 }
  },
  'embakasi': {
    name: 'Embakasi',
    cost: 7000,
    areas: ['embakasi', 'nairobi airport', 'airport', 'pipelines', 'radiation'],
    coordinates: { minLat: -1.310, maxLat: -1.360, minLng: 36.880, maxLng: 36.950 }
  },
  'nairobi_west': {
    name: 'Nairobi West',
    cost: 5000,
    areas: ['nairobi west', 'wood avenue', 'bomas', 'nyayo estate'],
    coordinates: { minLat: -1.315, maxLat: -1.340, minLng: 36.760, maxLng: 36.790 }
  },
  'outer_south': {
    name: 'Outer South',
    cost: 6000,
    areas: ['otiende', 'kangemi', 'riruta', 'soweto', 'kikuyu'],
    coordinates: { minLat: -1.340, maxLat: -1.400, minLng: 36.700, maxLng: 36.820 }
  },
  'outer_north': {
    name: 'Outer North',
    cost: 7000,
    areas: ['karen', 'thika', 'ruai', 'kahawa', 'kenyatta', 'kariobangi'],
    coordinates: { minLat: -1.235, maxLat: -1.260, minLng: 36.800, maxLng: 36.900 }
  }
};

// Outside Nairobi locations with distance-based transport pricing (KES)
const OUTSIDE_NAIROBI_ZONES = {
  'coast_mombasa': {
    name: 'Mombasa & Coast',
    region: 'Coast Region',
    distance: '500km',
    cost:80000,
    keywords: ['mombasa', 'diani', 'malindi', 'lamu', 'coast', 'kilifi', 'kwale'],
    description: 'Mombasa, Diani, Malindi, Lamu and surrounding coastal areas'
  },
  'western_kisumu': {
    name: 'Kisumu & Western',
    region: 'Western Region',
    distance: '300km',
    cost: 50000,
    keywords: ['kisumu', 'western', 'lake victoria', 'kericho', 'kisii', 'nakuru'],
    description: 'Kisumu, Kericho, Kisii and surrounding western region areas'
  },
  'rift_valley': {
    name: 'Rift Valley & Nakuru',
    region: 'Rift Valley Region',
    distance: '180km',
    cost: 30000,
    keywords: ['nakuru', 'rift valley', 'eldoret', 'naivasha', 'narok', 'kericho'],
    description: 'Nakuru, Naivasha, Eldoret, Kericho and surrounding Rift Valley areas'
  },
  'central_nyeri': {
    name: 'Central Region - Nyeri',
    region: 'Central Region',
    distance: '140km',
    cost: 23000,
    keywords: ['nyeri', 'central', 'muranga', 'kiambu', 'thika extended'],
    description: 'Nyeri, Murang\'a and surrounding central region areas'
  },
  'eastern_meru': {
    name: 'Eastern Region - Meru',
    region: 'Eastern Region',
    distance: '250km',
    cost: 40000,
    keywords: ['meru', 'eastern', 'embu', 'isiolo', 'machakos'],
    description: 'Meru, Embu, Isiolo, Machakos and surrounding eastern region areas'
  },
  'north_region': {
    name: 'North/Far North',
    region: 'Northern Region',
    distance: '450km',
    cost: 75000,
    keywords: ['samburu', 'turkana', 'marsabit', 'northern', 'north', 'far north'],
    description: 'Samburu, Turkana, Marsabit and far northern region areas'
  },
  'south_region': {
    name: 'South/Far South',
    region: 'Southern Region',
    distance: '250km',
    cost: 50000,
    keywords: ['narok', 'bomet', 'south', 'far south', 'maasai mara'],
    description: 'Narok, Bomet, Maasai Mara and surrounding southern region areas'
  }
};

// Default zone for unknown locations
const DEFAULT_ZONE = 'cbd';
const DEFAULT_COST = 2500; // Default transport cost for Nairobi
const DEFAULT_OUTSIDE_NAIROBI_COST = 15000; // Default cost for outside Nairobi (coastal)

class TransportService {
  /**
   * Get all available zones
   * @returns {object} All zones with their details
   */
  static getAllZones() {
    return { ...NAIROBI_ZONES };
  }

  /**
   * Get zone by key
   * @param {string} zoneKey - Zone identifier
   * @returns {object|null} Zone details or null
   */
  static getZone(zoneKey) {
    return NAIROBI_ZONES[zoneKey] || null;
  }

  /**
   * Get transport cost for a zone
   * @param {string} zoneKey - Zone identifier
   * @returns {number} Transport cost in KES
   */
  static getZoneCost(zoneKey) {
    const zone = NAIROBI_ZONES[zoneKey];
    return zone ? zone.cost : DEFAULT_COST;
  }

  /**
   * Match location string to zone
   * Performs fuzzy matching based on area keywords
   * @param {string} location - Location string from user input
   * @returns {object} { zoneKey, zone, cost, confidence }
   */
  static identifyZone(location) {
    if (!location || typeof location !== 'string') {
      return {
        zoneKey: DEFAULT_ZONE,
        zone: NAIROBI_ZONES[DEFAULT_ZONE],
        cost: this.getZoneCost(DEFAULT_ZONE),
        confidence: 'default'
      };
    }

    const normalizedLocation = location.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    // Search through all zones
    for (const [zoneKey, zoneData] of Object.entries(NAIROBI_ZONES)) {
      // Check exact area matches
      for (const area of zoneData.areas) {
        if (normalizedLocation === area) {
          // Perfect match - highest priority
          return {
            zoneKey,
            zone: zoneData,
            cost: zoneData.cost,
            confidence: 'exact'
          };
        }

        // Partial match scoring
        const score = this._calculateSimilarity(normalizedLocation, area);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { zoneKey, zoneData };
        }
      }

      // Also check zone name match
      const nameScore = this._calculateSimilarity(normalizedLocation, zoneData.name.toLowerCase());
      if (nameScore > bestScore) {
        bestScore = nameScore;
        bestMatch = { zoneKey, zoneData };
      }
    }

    // Return best match if found with reasonable confidence
    if (bestMatch && bestScore > 0.6) {
      return {
        zoneKey: bestMatch.zoneKey,
        zone: bestMatch.zoneData,
        cost: bestMatch.zoneData.cost,
        confidence: bestScore > 0.8 ? 'high' : 'moderate'
      };
    }

    // Return default zone
    return {
      zoneKey: DEFAULT_ZONE,
      zone: NAIROBI_ZONES[DEFAULT_ZONE],
      cost: this.getZoneCost(DEFAULT_ZONE),
      confidence: 'default'
    };
  }

  /**
   * Calculate string similarity (Levenshtein-based simple version)
   * Returns score between 0 and 1
   * @private
   */
  static _calculateSimilarity(str1, str2) {
    let longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    // Check if shorter is substring of longer
    if (longer.indexOf(shorter) !== -1) {
      return 0.9;
    }

    // Simple character overlap calculation
    let matches = 0;
    for (let char of shorter) {
      if (longer.indexOf(char) !== -1) {
        matches++;
        longer = longer.replace(char, '');
      }
    }

    return matches / shorter.length;
  }

  /**
   * Validate if location is within service area (Nairobi or Outside Nairobi)
   * @param {string} location - Location string
   * @returns {boolean} True if location is likely in Nairobi or recognized outside Nairobi location
   */
  static isWithinServiceArea(location) {
    // Check if it's outside Nairobi first
    if (this.isOutsideNairobi(location)) {
      return true;
    }

    // Check if it's within Nairobi
    const zoneInfo = this.identifyZone(location);
    // Any zone with confidence level (not completely unknown) indicates within service area
    return zoneInfo.confidence !== 'default' || location.toLowerCase().includes('nairobi');
  }

  /**
   * Calculate transport fee for a booking
   * Automatically detects if location is in Nairobi or outside Nairobi
   * and applies appropriate billing rates
   * @param {string} eventLocation - Event location string
   * @returns {object} { zoneKey, zoneName, transportCost, locationArea, zoneInfo, serviceArea }
   */
  static calculateTransportCost(eventLocation) {
    // Check if location is outside Nairobi first
    if (this.isOutsideNairobi(eventLocation)) {
      const outsideZoneInfo = this.identifyOutsideNairobiZone(eventLocation);
      
      return {
        zoneKey: outsideZoneInfo.zoneKey,
        zoneName: outsideZoneInfo.zone.name,
        transportCost: outsideZoneInfo.cost,
        locationArea: outsideZoneInfo.zone.region,
        serviceArea: 'outside-nairobi',
        zoneInfo: {
          cost: outsideZoneInfo.cost,
          distance: outsideZoneInfo.zone.distance,
          region: outsideZoneInfo.zone.region,
          description: outsideZoneInfo.zone.description,
          confidence: outsideZoneInfo.confidence
        }
      };
    }

    // Otherwise, it's a Nairobi location
    const nairobiZoneInfo = this.identifyZone(eventLocation);

    return {
      zoneKey: nairobiZoneInfo.zoneKey,
      zoneName: nairobiZoneInfo.zone.name,
      transportCost: nairobiZoneInfo.cost,
      locationArea: 'Nairobi',
      serviceArea: 'nairobi',
      zoneInfo: {
        cost: nairobiZoneInfo.cost,
        confidence: nairobiZoneInfo.confidence,
        allAreas: nairobiZoneInfo.zone.areas
      }
    };
  }

  /**
   * Get nearby zones (useful for recommendations when location is uncertain)
   * @param {string} zoneKey - Zone identifier
   * @returns {array} Array of nearby zone keys
   */
  static getNearbyZones(zoneKey) {
    const nearbyMap = {
      'cbd': ['westlands', 'nairobi_west', 'kilimani'],
      'westlands': ['cbd', 'kilimani', 'northlands', 'southlands'],
      'karen': ['southlands', 'outer_south', 'nairobi_west'],
      'kilimani': ['westlands', 'cbd', 'muthaiga'],
      'southlands': ['karen', 'westlands', 'kilimani'],
      'eastlands': ['embakasi', 'kasarani', 'cbd'],
      'northlands': ['kasarani', 'westlands', 'cbd'],
      'kasarani': ['northlands', 'eastlands', 'embakasi'],
      'embakasi': ['eastlands', 'kasarani', 'outer_north'],
      'nairobi_west': ['cbd', 'outer_south', 'karen'],
      'outer_south': ['karen', 'nairobi_west', 'outer_north'],
      'outer_north': ['kasarani', 'embakasi', 'outer_south']
    };

    return (nearbyMap[zoneKey] || []).map(key => ({
      key,
      name: NAIROBI_ZONES[key].name,
      cost: NAIROBI_ZONES[key].cost
    }));
  }

  /**
   * Get all outside Nairobi zones
   * @returns {object} All outside Nairobi zones with their details
   */
  static getOutsideNairobiZones() {
    return { ...OUTSIDE_NAIROBI_ZONES };
  }

  /**
   * Detect if location is outside Nairobi
   * Uses keyword matching for common locations
   * @param {string} location - Location string
   * @returns {boolean} True if location appears to be outside Nairobi
   */
  static isOutsideNairobi(location) {
    if (!location || typeof location !== 'string') return false;

    const normalizedLocation = location.toLowerCase().trim();
    const nairobiKeywords = [
      'nairobi', 'cbd', 'westlands', 'karen', 'kilimani', 'southlands',
      'eastlands', 'northlands', 'kasarani', 'embakasi', 'parklands',
      'gigiri', 'runda', 'langata', 'lavington', 'muthaiga', 'hurlingham',
      'industrial area', 'juja road', 'mlolongo'
    ];

    // Check if location contains Nairobi keywords
    const hasNairobiKeyword = nairobiKeywords.some(keyword =>
      normalizedLocation.includes(keyword)
    );

    if (hasNairobiKeyword) return false;

    // Check if location contains outside Nairobi keywords
    for (const zone of Object.values(OUTSIDE_NAIROBI_ZONES)) {
      for (const keyword of zone.keywords) {
        if (normalizedLocation.includes(keyword)) {
          return true;
        }
      }
    }

    // If contains words like 'mombasa', 'kisumu', 'county', 'region' likely outside
    const outsideIndicators = ['mombasa', 'kisumu', 'nakuru', 'coast', 'county', 'region', 'western', 'eastern'];
    return outsideIndicators.some(indicator => normalizedLocation.includes(indicator));
  }

  /**
   * Identify outside Nairobi zone by location string
   * @param {string} location - Location string from user input
   * @returns {object} { zoneKey, zone, cost, distance, region }
   */
  static identifyOutsideNairobiZone(location) {
    if (!location || typeof location !== 'string') {
      return {
        zoneKey: 'coast_mombasa',
        zone: OUTSIDE_NAIROBI_ZONES['coast_mombasa'],
        cost: OUTSIDE_NAIROBI_ZONES['coast_mombasa'].cost,
        confidence: 'default'
      };
    }

    const normalizedLocation = location.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    // Search through all outside Nairobi zones
    for (const [zoneKey, zoneData] of Object.entries(OUTSIDE_NAIROBI_ZONES)) {
      // Check exact keyword matches
      for (const keyword of zoneData.keywords) {
        if (normalizedLocation === keyword) {
          return {
            zoneKey,
            zone: zoneData,
            cost: zoneData.cost,
            confidence: 'exact'
          };
        }

        // Partial match scoring
        const score = this._calculateSimilarity(normalizedLocation, keyword);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = { zoneKey, zoneData };
        }
      }

      // Check zone name match
      const nameScore = this._calculateSimilarity(normalizedLocation, zoneData.name.toLowerCase());
      if (nameScore > bestScore) {
        bestScore = nameScore;
        bestMatch = { zoneKey, zoneData };
      }
    }

    // Return best match if found with reasonable confidence
    if (bestMatch && bestScore > 0.6) {
      return {
        zoneKey: bestMatch.zoneKey,
        zone: bestMatch.zoneData,
        cost: bestMatch.zoneData.cost,
        confidence: bestScore > 0.8 ? 'high' : 'moderate'
      };
    }

    // Return default (Mombasa/Coast) for unknown outside Nairobi locations
    return {
      zoneKey: 'coast_mombasa',
      zone: OUTSIDE_NAIROBI_ZONES['coast_mombasa'],
      cost: OUTSIDE_NAIROBI_ZONES['coast_mombasa'].cost,
      confidence: 'default'
    };
  }

  /**
   * Get nearby outside Nairobi zones (for cross-region travel recommendations)
   * @param {string} zoneKey - Outside Nairobi zone identifier
   * @returns {array} Array of nearby zone keys
   */
  static getNearbyOutsideNairobiZones(zoneKey) {
    const nearbyMap = {
      'coast_mombasa': ['eastern_meru', 'south_region'],
      'western_kisumu': ['rift_valley', 'central_nyeri'],
      'rift_valley': ['western_kisumu', 'central_nyeri', 'south_region'],
      'central_nyeri': ['western_kisumu', 'rift_valley'],
      'eastern_meru': ['coast_mombasa', 'north_region'],
      'north_region': ['eastern_meru'],
      'south_region': ['rift_valley', 'coast_mombasa']
    };

    return (nearbyMap[zoneKey] || []).map(key => ({
      key,
      name: OUTSIDE_NAIROBI_ZONES[key].name,
      cost: OUTSIDE_NAIROBI_ZONES[key].cost,
      distance: OUTSIDE_NAIROBI_ZONES[key].distance,
      region: OUTSIDE_NAIROBI_ZONES[key].region
    }));
  }
}

module.exports = TransportService;

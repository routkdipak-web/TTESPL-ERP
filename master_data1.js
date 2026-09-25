window.MASTER_DATA = {
  // Metadata for categories & sheets
  "CATEGORIES": [
    "High Pressure Plunger Pumps & Washers",
    "Steam Washers & Generators",
    "Industrial Vacuum Cleaners",
    "Machines Spare Parts",
    "Nozzles, Guns & Hoses",
    "Electricals & Motors",
    "Chemicals & Detergents",
    "Accessories & Attachments",
    "General Hardware & Fittings"
  ],

  // Full unified inventory with deep details
  "INVENTORY": [
    // --- 1. MACHINERY & MAJOR ASSEMBLIES ---
    {
      "id": "mc_01",
      "name": "AR Plunger Pump Assembly 23262",
      "code": "23262",
      "category": "High Pressure Plunger Pumps & Washers",
      "machine_model": "AR HRC Series / Industrial Car Washer",
      "stock": 10,
      "rate": 40918.86,
      "dealer_price": 30689.44,
      "hsn": "8413",
      "description": "Complete industrial triplex plunger pump assembly with crankcase and manifold.",
      "technical_specs": {
        "type": "Triplex Plunger",
        "rpm": 1450,
        "head_code": "3209200",
        "compatible_motor": "45007 / 45008"
      }
    },
    {
      "id": "mc_02",
      "name": "Pump Assembly 25404 (42.10 Series)",
      "code": "25404",
      "category": "High Pressure Plunger Pumps & Washers",
      "machine_model": "XWL 42.10 / Heavy Industrial Setup",
      "stock": 10,
      "rate": 64156.60,
      "dealer_price": 48118.04,
      "hsn": "8413",
      "description": "High capacity industrial pressure washing pump assembly for commercial bays.",
      "technical_specs": {
        "flow_rate": "42 LPM",
        "max_pressure": "100-150 Bar",
        "head_assembly": "4029200",
        "plunger_dia": "Solid Ceramic"
      }
    },
    {
      "id": "mc_03",
      "name": "Industrial High Pressure Pump 23507",
      "code": "23507",
      "category": "High Pressure Plunger Pumps & Washers",
      "machine_model": "AR Series 322",
      "stock": 10,
      "rate": 50172.42,
      "dealer_price": 37629.02,
      "hsn": "8413",
      "description": "Heavy duty commercial wash pump assembly complete with brass manifold.",
      "technical_specs": {
        "compatible_head": "3229200",
        "shaft_type": "Keyed 24mm / 28mm",
        "lubrication": "Synthetic 15W-40"
      }
    },
    {
      "id": "mc_04",
      "name": "Combustion Chamber Steam Assembly",
      "code": "S8A011063LC",
      "category": "Steam Washers & Generators",
      "machine_model": "FX1-D / FX1-G Diesel Steam Machine",
      "stock": 10,
      "rate": 108465.60,
      "dealer_price": 81349.20,
      "hsn": "8402",
      "description": "Complete internal combustion heating coil boiler unit for mobile/static diesel steam washers.",
      "technical_specs": {
        "fuel_type": "Diesel",
        "burner_code": "SGA012003BN",
        "ignition": "TR Ignition S8A099008GR"
      }
    },
    {
      "id": "mc_05",
      "name": "Electric Heater Steam Generator (10KW)",
      "code": "S8A086001HT",
      "category": "Steam Washers & Generators",
      "machine_model": "FX1-E Electric Steam Cleaner",
      "stock": 10,
      "rate": 52434.48,
      "dealer_price": 39325.86,
      "hsn": "8402",
      "description": "High temperature 3-phase electric steam generation heating unit.",
      "technical_specs": {
        "voltage": "380V - 415V 3-Phase",
        "power": "10 KW",
        "breaker": "EBS-54c (30A-4P)"
      }
    },
    {
      "id": "mc_06",
      "name": "Nano Steam Boiler Unit 2L",
      "code": "CECV011",
      "category": "Steam Washers & Generators",
      "machine_model": "Steam Wave / Steam Plus VIP",
      "stock": 10,
      "rate": 27516.42,
      "dealer_price": 20637.02,
      "hsn": "8402",
      "description": "Compact steam generator boiler chamber with graphite insulation.",
      "technical_specs": {
        "capacity": "2.0 Liters",
        "pressure": "9 Bar Max",
        "safety_cap": "CETA038A (6.5-7.5 bar)"
      }
    },
    {
      "id": "mc_07",
      "name": "Turbine Threephase Single-Stage (4.0 KW)",
      "code": "CETT004",
      "category": "Industrial Vacuum Cleaners",
      "machine_model": "Heavy Duty Industrial Central Vacuum",
      "stock": 10,
      "rate": 145292.22,
      "dealer_price": 108969.46,
      "hsn": "8508",
      "description": "Induction side-channel continuous turbine suction unit for multi-bay detailing vacuum systems.",
      "technical_specs": {
        "power": "4.0 KW",
        "supply": "400V 3-Phase 50Hz",
        "overload_protector": "CESM914 (9-14A)"
      }
    },
    {
      "id": "mc_08",
      "name": "Turbine Threephase Double-Stage (5.5 KW)",
      "code": "CETT055",
      "category": "Industrial Vacuum Cleaners",
      "machine_model": "Industrial Vacuum 5.5KW Heavy Plant",
      "stock": 10,
      "rate": 268230.52,
      "dealer_price": 201173.48,
      "hsn": "8508",
      "description": "High static lift double turbine suction motor for extreme industrial extraction.",
      "technical_specs": {
        "power": "5.5 KW",
        "stage": "Dual Stage Turbine",
        "body_material": "AISI 430 SS Tank"
      }
    },
    {
      "id": "mc_09",
      "name": "Turbine Threephase (2.2 KW)",
      "code": "CETT022",
      "category": "Industrial Vacuum Cleaners",
      "machine_model": "Compact Industrial Three-Phase Vacuum",
      "stock": 10,
      "rate": 119280.30,
      "dealer_price": 89460.52,
      "hsn": "8508",
      "description": "Compact three phase vacuum turbine setup for daily detailing bay extraction.",
      "technical_specs": {
        "power": "2.2 KW",
        "overload_protector": "CESM6310 (6.3-10A)"
      }
    },
    {
      "id": "mc_10",
      "name": "Estro 77L Extraction Machine Base & Tank",
      "code": "CPFU580E.2",
      "category": "Industrial Vacuum Cleaners",
      "machine_model": "Estro 77 / Ares Upholstery Extractor",
      "stock": 10,
      "rate": 12525.70,
      "dealer_price": 9393.98,
      "hsn": "8508",
      "description": "Tipping polypropylene chemical and extraction recovery tank unit with tipping chassis.",
      "technical_specs": {
        "capacity": "77 Liters",
        "tank_material": "PP Heavy Grade",
        "motor_configuration": "2-3 Motor Compatible"
      }
    },

    // --- 2. VALVES, KITS & PUMP SPARES ---
    {
      "id": "sp_2186",
      "name": "Complete Valve Kit - Kit A",
      "code": "2186",
      "category": "Machines Spare Parts",
      "machine_model": "HRC Series / AR Triplex Pumps",
      "stock": 10,
      "rate": 1608.34,
      "dealer_price": 1205.96,
      "hsn": "841391",
      "description": "Inlet and delivery valve set including O-rings and retainers.",
      "technical_specs": {
        "parts_included": "6 valves + 6 O-rings",
        "material": "Stainless Steel / Brass Cage"
      }
    },
    {
      "id": "sp_2782",
      "name": "Water Seal Kit (High Pressure)",
      "code": "2782",
      "category": "Machines Spare Parts",
      "machine_model": "HXW 21.15 / XWL Series",
      "stock": 10,
      "rate": 6580.86,
      "dealer_price": 4935.94,
      "hsn": "8484",
      "description": "V-packing high and low pressure water seal set for plunger lubrication.",
      "technical_specs": {
        "plunger_size": "Dia 20mm / 22mm",
        "temperature_limit": "60°C"
      }
    },
    {
      "id": "sp_22308",
      "name": "VR 3B Unloader Valve Assembly",
      "code": "22308",
      "category": "Machines Spare Parts",
      "machine_model": "RK / HRK / HRC Series",
      "stock": 10,
      "rate": 17171.36,
      "dealer_price": 12878.52,
      "hsn": "8481",
      "description": "Automatic pressure regulating bypass valve with microswitch bracket option.",
      "technical_specs": {
        "bypass_type": "Internal / External Bypass",
        "rated_pressure": "250 Bar"
      }
    },
    {
      "id": "sp_20821",
      "name": "Minimatic 4/B Unloader Valve",
      "code": "20821",
      "category": "Machines Spare Parts",
      "machine_model": "AR HRC Series",
      "stock": 10,
      "rate": 9460.06,
      "dealer_price": 7095.34,
      "hsn": "8481",
      "description": "Integrated bolt-on unloader valve with adjustable knob.",
      "technical_specs": {
        "fitting": "Banjo Bolt / Direct Flange",
        "inlet": "1/2 inch BSP"
      }
    },

    // --- 3. VACUUM MOTORS & ACCESSORIES ---
    {
      "id": "sp_mo1400",
      "name": "Double Stage By-Pass Suction Motor 1400W",
      "code": "MO12382BPR",
      "category": "Electricals & Motors",
      "machine_model": "Estro 125, Estro 250, PC38 Series",
      "stock": 10,
      "rate": 9534.40,
      "dealer_price": 7150.80,
      "hsn": "8501",
      "description": "Double stage tangential by-pass peripheral discharge vacuum suction motor.",
      "technical_specs": {
        "wattage": "1400 Watts",
        "voltage": "230V AC 50Hz",
        "air_flow": "54 L/sec"
      }
    },
    {
      "id": "sp_hose_steam",
      "name": "Steam Hose with Grip 10m (Diesel Model)",
      "code": "S8A019001AH",
      "category": "Nozzles, Guns & Hoses",
      "machine_model": "FX1-D Series Diesel Steam Cleaner",
      "stock": 10,
      "rate": 54490.04,
      "dealer_price": 40868.12,
      "hsn": "4009",
      "description": "Heavy insulated high temp thermal steam pressure delivery hose with trigger cable.",
      "technical_specs": {
        "length": "10 Meters",
        "max_temp": "210°C",
        "fittings": "1/4 Quick Coupler"
      }
    }
  ]
};

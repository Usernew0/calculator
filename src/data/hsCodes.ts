export interface HsCodeItem {
  code: string;
  categoryEn: string;
  categoryAr: string;
  descriptionEn: string;
  descriptionAr: string;
  dutyRate: number; // percentage e.g. 5 for 5%
  isCustom?: boolean;
}

export const INITIAL_HS_CODES: HsCodeItem[] = [
  // Electronics & Tech
  { code: '8517.13', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'Smartphones & Mobile Handsets', descriptionAr: 'الهواتف الذكية وأجهزة المحمول', dutyRate: 5 },
  { code: '8471.30', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'Laptops, Notebooks & Tablet Computers', descriptionAr: 'أجهزة اللابتوب والتابلت المحمولة', dutyRate: 0 },
  { code: '8528.52', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'Computer Monitors & Color Displays', descriptionAr: 'شاشات الكمبيوتر والعرض الملونة', dutyRate: 5 },
  { code: '8504.40', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'Power Supplies, Inverters & Fast Chargers', descriptionAr: 'محولات الطاقة والشواحن السريعة', dutyRate: 2 },
  { code: '8541.43', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'Photovoltaic Solar Panels & Cells', descriptionAr: 'الألواح والخلايا الشمسية الكهروضوئية', dutyRate: 0 },
  { code: '8525.89', categoryEn: 'Electronics', categoryAr: 'إلكترونيات', descriptionEn: 'CCTV Security Cameras & Optical Sensors', descriptionAr: 'كاميرات المراقبة وأجهزة المستشعرات', dutyRate: 10 },

  // Apparel, Textiles & Leather
  { code: '6109.10', categoryEn: 'Textiles & Apparel', categoryAr: 'منسوجات وملابس', descriptionEn: 'Cotton T-Shirts & Knitted Wear', descriptionAr: 'قمصان قطنية (تيشرتات) ومنسوجات', dutyRate: 12 },
  { code: '6203.42', categoryEn: 'Textiles & Apparel', categoryAr: 'منسوجات وملابس', descriptionEn: 'Men Cotton Trousers & Denim Jeans', descriptionAr: 'بنطلونات قطنية وجينز رجالي', dutyRate: 12 },
  { code: '6403.99', categoryEn: 'Textiles & Apparel', categoryAr: 'منسوجات وملابس', descriptionEn: 'Leather Footwear & Sports Shoes', descriptionAr: 'أحذية جلدية وأحذية رياضية', dutyRate: 15 },
  { code: '4202.21', categoryEn: 'Textiles & Apparel', categoryAr: 'منسوجات وملابس', descriptionEn: 'Handbags & Travel Goods with Outer Leather Surface', descriptionAr: 'حقائب يدوية وأمتعة سفر جلدية', dutyRate: 20 },

  // Machinery & Equipment
  { code: '8414.59', categoryEn: 'Machinery & Equipment', categoryAr: 'آلات ومعدات', descriptionEn: 'Industrial Air Blowers & Ventilation Fans', descriptionAr: 'مراوح التهوية والشفاطات الصناعية', dutyRate: 5 },
  { code: '8413.70', categoryEn: 'Machinery & Equipment', categoryAr: 'آلات ومعدات', descriptionEn: 'Centrifugal Water Pumps & Fluid Compressors', descriptionAr: 'مضخات المياه الطاردة المركزية', dutyRate: 2 },
  { code: '8458.11', categoryEn: 'Machinery & Equipment', categoryAr: 'آلات ومعدات', descriptionEn: 'CNC Machine Tools & Lathes', descriptionAr: 'ماكينات الخراطة والتحكم الرقمي CNC', dutyRate: 0 },
  { code: '8415.10', categoryEn: 'Machinery & Equipment', categoryAr: 'آلات ومعدات', descriptionEn: 'Window or Split Air Conditioning Units', descriptionAr: 'أجهزة تكييف الهواء (سبليت وشباك)', dutyRate: 20 },

  // Automotive & Transport
  { code: '8708.29', categoryEn: 'Automotive & Parts', categoryAr: 'سيارات وقطع غيار', descriptionEn: 'Motor Vehicle Body Parts & Accessories', descriptionAr: 'أجزاء وإكسسوارات هياكل السيارات', dutyRate: 10 },
  { code: '8708.92', categoryEn: 'Automotive & Parts', categoryAr: 'سيارات وقطع غيار', descriptionEn: 'Exhaust Systems, Silencers & Mufflers', descriptionAr: 'شكمانات وأنظمة عادم السيارات', dutyRate: 10 },
  { code: '4011.10', categoryEn: 'Automotive & Parts', categoryAr: 'سيارات وقطع غيار', descriptionEn: 'Pneumatic Rubber Tires for Passenger Cars', descriptionAr: 'إطارات مطاطية لسيارات الركوب', dutyRate: 12 },

  // Food, Agriculture & Beverages
  { code: '0901.21', categoryEn: 'Food & Agriculture', categoryAr: 'أغذية وزراعة', descriptionEn: 'Roasted Non-Decaffeinated Coffee Beans', descriptionAr: 'بن قهوة محمص غير منزوع الكافيين', dutyRate: 5 },
  { code: '1509.20', categoryEn: 'Food & Agriculture', categoryAr: 'أغذية وزراعة', descriptionEn: 'Extra Virgin Olive Oil & Edible Oils', descriptionAr: 'زيت زيتون بكر ممتاز والزيوت الغذائية', dutyRate: 5 },
  { code: '1806.32', categoryEn: 'Food & Agriculture', categoryAr: 'أغذية وزراعة', descriptionEn: 'Chocolate & Cocoa Food Preparations', descriptionAr: 'الشوكولاتة ومحضرات الكاكاو', dutyRate: 15 },
  { code: '1001.99', categoryEn: 'Food & Agriculture', categoryAr: 'أغذية وزراعة', descriptionEn: 'Wheat & Meslin Grain Grains', descriptionAr: 'حبوب القمح والذرة', dutyRate: 0 },

  // Medical & Health
  { code: '9018.90', categoryEn: 'Medical & Health', categoryAr: 'أجهزة وطبابة', descriptionEn: 'Medical, Surgical & Dental Instruments', descriptionAr: 'الأدوات والأجهزة الطبية والجراحية', dutyRate: 0 },
  { code: '3004.90', categoryEn: 'Medical & Health', categoryAr: 'أجهزة وطبابة', descriptionEn: 'Medicaments & Pharmaceutical Products', descriptionAr: 'الأدوية والمستحضرات الصيدلانية', dutyRate: 0 },
  { code: '9027.89', categoryEn: 'Medical & Health', categoryAr: 'أجهزة وطبابة', descriptionEn: 'Diagnostic Reagents & Analytical Lab Instruments', descriptionAr: 'أجهزة التحاليل المخبرية والكواشف', dutyRate: 2 },

  // Cosmetics, Chemicals & Plastics
  { code: '3304.99', categoryEn: 'Cosmetics & Beauty', categoryAr: 'مستحضرات تجميل', descriptionEn: 'Skincare Creams & Beauty Preparations', descriptionAr: 'مستحضرات العناية بالبشرة والتجميل', dutyRate: 10 },
  { code: '3307.20', categoryEn: 'Cosmetics & Beauty', categoryAr: 'مستحضرات تجميل', descriptionEn: 'Personal Deodorants & Antiperspirants', descriptionAr: 'مزيلات العرق ومستحضرات النظافة', dutyRate: 10 },
  { code: '3923.30', categoryEn: 'Plastics & Packaging', categoryAr: 'بلاستيك وتغليف', descriptionEn: 'Plastic Bottles, Carboys & Packaging Containers', descriptionAr: 'عبوات وزجاجات البلاستيك للتغليف', dutyRate: 8 },

  // Home, Furniture & Construction
  { code: '9403.60', categoryEn: 'Home & Furniture', categoryAr: 'أثاث وديكور', descriptionEn: 'Wooden Furniture & Office Desks', descriptionAr: 'الأثاث الخشبي والمكاتب الإدارية', dutyRate: 15 },
  { code: '9405.11', categoryEn: 'Home & Furniture', categoryAr: 'أثاث وديكور', descriptionEn: 'LED Chandeliers & Ceiling Lighting Fittings', descriptionAr: 'نجف وإضاءات LED ومستلزمات السقف', dutyRate: 10 },
  { code: '6907.21', categoryEn: 'Home & Furniture', categoryAr: 'أثاث وديكور', descriptionEn: 'Ceramic & Porcelain Flooring Tiles', descriptionAr: 'بلاط السيراميك والبورسلين للأرضيات', dutyRate: 15 },
];

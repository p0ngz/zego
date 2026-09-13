/**
 * Fields of study for the education step.
 *
 * Kept in this order on purpose — the roles this form is used for are
 * software roles, so computing and engineering come first and a person
 * usually finds their major without scrolling. The box still takes
 * anything typed into it, so the list needs to be good rather than
 * complete. The secondary-school tracks at the end are for applicants
 * whose highest level is school.
 */

export interface MajorSeed {
  nameTh: string;
  nameEn: string;
}

const rows: [nameTh: string, nameEn: string][] = [
  // Computing
  ['วิศวกรรมคอมพิวเตอร์', 'Computer Engineering'],
  ['วิทยาการคอมพิวเตอร์', 'Computer Science'],
  ['เทคโนโลยีสารสนเทศ', 'Information Technology'],
  ['วิศวกรรมซอฟต์แวร์', 'Software Engineering'],
  ['ระบบสารสนเทศทางธุรกิจ', 'Business Information Systems'],
  ['วิทยาการข้อมูล', 'Data Science'],
  ['ปัญญาประดิษฐ์', 'Artificial Intelligence'],
  ['ความมั่นคงปลอดภัยไซเบอร์', 'Cybersecurity'],
  ['เทคโนโลยีมัลติมีเดียและแอนิเมชัน', 'Multimedia and Animation'],
  ['เกมและสื่อโต้ตอบ', 'Game and Interactive Media'],
  ['เทคโนโลยีดิจิทัลเพื่อธุรกิจ', 'Digital Technology for Business'],
  ['คอมพิวเตอร์ธุรกิจ', 'Business Computer'],

  // Engineering
  ['วิศวกรรมไฟฟ้า', 'Electrical Engineering'],
  ['วิศวกรรมอิเล็กทรอนิกส์', 'Electronics Engineering'],
  ['วิศวกรรมโทรคมนาคม', 'Telecommunications Engineering'],
  ['วิศวกรรมเมคคาทรอนิกส์', 'Mechatronics Engineering'],
  ['วิศวกรรมเครื่องกล', 'Mechanical Engineering'],
  ['วิศวกรรมยานยนต์', 'Automotive Engineering'],
  ['วิศวกรรมโยธา', 'Civil Engineering'],
  ['วิศวกรรมอุตสาหการ', 'Industrial Engineering'],
  ['วิศวกรรมการผลิต', 'Manufacturing Engineering'],
  ['วิศวกรรมเคมี', 'Chemical Engineering'],
  ['วิศวกรรมสิ่งแวดล้อม', 'Environmental Engineering'],
  ['วิศวกรรมชีวการแพทย์', 'Biomedical Engineering'],
  ['วิศวกรรมสำรวจ', 'Survey Engineering'],

  // Business
  ['บริหารธุรกิจ', 'Business Administration'],
  ['การจัดการ', 'Management'],
  ['การตลาด', 'Marketing'],
  ['การตลาดดิจิทัล', 'Digital Marketing'],
  ['การบัญชี', 'Accounting'],
  ['การเงินและการธนาคาร', 'Finance and Banking'],
  ['เศรษฐศาสตร์', 'Economics'],
  ['เศรษฐศาสตร์ธุรกิจ', 'Business Economics'],
  ['การจัดการโลจิสติกส์และโซ่อุปทาน', 'Logistics and Supply Chain Management'],
  ['การจัดการการขนส่ง', 'Transport Management'],
  ['การค้าระหว่างประเทศ', 'International Trade'],
  ['การจัดการทรัพยากรมนุษย์', 'Human Resource Management'],
  ['ธุรกิจระหว่างประเทศ', 'International Business'],
  ['การประกอบการและนวัตกรรม', 'Entrepreneurship and Innovation'],
  ['การจัดการโรงแรมและการท่องเที่ยว', 'Hotel and Tourism Management'],
  ['เลขานุการและการจัดการสำนักงาน', 'Secretarial and Office Management'],
  ['สถิติและการประกันภัย', 'Statistics and Insurance'],

  // Communication, arts and design
  ['นิเทศศาสตร์', 'Communication Arts'],
  ['วารสารศาสตร์', 'Journalism'],
  ['การโฆษณา', 'Advertising'],
  ['การประชาสัมพันธ์', 'Public Relations'],
  ['ภาพยนตร์และสื่อดิจิทัล', 'Film and Digital Media'],
  ['วิทยุกระจายเสียงและโทรทัศน์', 'Broadcasting'],
  ['ออกแบบนิเทศศิลป์', 'Visual Communication Design'],
  ['ออกแบบผลิตภัณฑ์', 'Product Design'],
  ['ออกแบบภายใน', 'Interior Design'],
  ['จิตรกรรมและประติมากรรม', 'Painting and Sculpture'],
  ['ดุริยางคศิลป์', 'Music'],
  ['ศิลปะการแสดง', 'Performing Arts'],
  ['แฟชั่นและสิ่งทอ', 'Fashion and Textiles'],
  ['สถาปัตยกรรม', 'Architecture'],
  ['สถาปัตยกรรมภายใน', 'Interior Architecture'],
  ['ภูมิสถาปัตยกรรม', 'Landscape Architecture'],
  ['การผังเมือง', 'Urban Planning'],

  // Humanities and social sciences
  ['อักษรศาสตร์ / ศิลปศาสตร์', 'Liberal Arts'],
  ['ภาษาอังกฤษ', 'English'],
  ['ภาษาอังกฤษเพื่อการสื่อสารธุรกิจ', 'Business English'],
  ['ภาษาไทย', 'Thai'],
  ['ภาษาญี่ปุ่น', 'Japanese'],
  ['ภาษาจีน', 'Chinese'],
  ['ภาษาเกาหลี', 'Korean'],
  ['ภาษาฝรั่งเศส', 'French'],
  ['ภาษาศาสตร์', 'Linguistics'],
  ['ประวัติศาสตร์', 'History'],
  ['ปรัชญา', 'Philosophy'],
  ['บรรณารักษศาสตร์และสารสนเทศศาสตร์', 'Library and Information Science'],
  ['การท่องเที่ยวและการโรงแรม', 'Tourism and Hospitality'],
  ['นิติศาสตร์', 'Law'],
  ['รัฐศาสตร์', 'Political Science'],
  ['รัฐประศาสนศาสตร์', 'Public Administration'],
  ['ความสัมพันธ์ระหว่างประเทศ', 'International Relations'],
  ['สังคมวิทยาและมานุษยวิทยา', 'Sociology and Anthropology'],
  ['สังคมสงเคราะห์ศาสตร์', 'Social Work'],
  ['การพัฒนาชุมชน', 'Community Development'],
  ['จิตวิทยา', 'Psychology'],
  ['จิตวิทยาอุตสาหกรรมและองค์การ', 'Industrial and Organizational Psychology'],
  ['ครุศาสตร์ / ศึกษาศาสตร์', 'Education'],
  ['การศึกษาปฐมวัย', 'Early Childhood Education'],
  ['เทคโนโลยีการศึกษา', 'Educational Technology'],
  ['พลศึกษา', 'Physical Education'],

  // Sciences
  ['คณิตศาสตร์', 'Mathematics'],
  ['สถิติ', 'Statistics'],
  ['ฟิสิกส์', 'Physics'],
  ['เคมี', 'Chemistry'],
  ['ชีววิทยา', 'Biology'],
  ['จุลชีววิทยา', 'Microbiology'],
  ['เทคโนโลยีชีวภาพ', 'Biotechnology'],
  ['วิทยาศาสตร์สิ่งแวดล้อม', 'Environmental Science'],
  ['เทคโนโลยีการอาหาร', 'Food Technology'],
  ['วัสดุศาสตร์', 'Materials Science'],
  ['ภูมิศาสตร์และภูมิสารสนเทศ', 'Geography and Geoinformatics'],
  ['เกษตรศาสตร์', 'Agriculture'],
  ['สัตวศาสตร์', 'Animal Science'],
  ['ประมง', 'Fisheries'],
  ['วนศาสตร์', 'Forestry'],
  ['พืชศาสตร์', 'Plant Science'],

  // Health
  ['แพทยศาสตร์', 'Medicine'],
  ['ทันตแพทยศาสตร์', 'Dentistry'],
  ['เภสัชศาสตร์', 'Pharmacy'],
  ['พยาบาลศาสตร์', 'Nursing'],
  ['สาธารณสุขศาสตร์', 'Public Health'],
  ['อาชีวอนามัยและความปลอดภัย', 'Occupational Health and Safety'],
  ['เทคนิคการแพทย์', 'Medical Technology'],
  ['กายภาพบำบัด', 'Physical Therapy'],
  ['รังสีเทคนิค', 'Radiologic Technology'],
  ['สัตวแพทยศาสตร์', 'Veterinary Medicine'],
  ['วิทยาศาสตร์การกีฬา', 'Sports Science'],

  // Secondary-school tracks
  ['วิทยาศาสตร์-คณิตศาสตร์ (สายมัธยม)', 'Science and Mathematics track'],
  ['ศิลป์-ภาษา (สายมัธยม)', 'Arts and Languages track'],
  ['ศิลป์-คำนวณ (สายมัธยม)', 'Arts and Mathematics track'],
  ['ศิลป์-สังคม (สายมัธยม)', 'Arts and Social Studies track'],
  ['ทั่วไป (สายมัธยม)', 'General track'],
];

export const MAJORS: MajorSeed[] = rows.map(([nameTh, nameEn]) => ({ nameTh, nameEn }));

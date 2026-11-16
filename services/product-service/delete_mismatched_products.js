const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres:postgres@localhost:5432/zeromall'
});

// Bản đồ nhận diện nội dung THỰC TẾ của các ảnh Unsplash trong hệ thống
const IMAGE_CONTENT = {
  // 1. Điện thoại & Phụ kiện
  'photo-1624275353151-f21e28a7dfaa': 'Cáp Sạc',
  'photo-1588515724527-074a7a56616c': 'Cáp Sạc',
  'photo-1583863788434-e58a36330cf0': 'Củ Sạc',
  'photo-1530545233050-3f0a5d0dd1ac': 'Củ Sạc',
  'photo-1561744436-df9ca770d05c': 'Kính Cường Lực',
  'photo-1567428486597-8c5328fd3816': 'Kính Cường Lực',
  'photo-1601784551446-20c9e07cdbdb': 'Ốp Lưng',
  'photo-1586953208448-b95a79798f07': 'Ốp Lưng',
  'photo-1565849904461-04a58ad377e0': 'Ốp Lưng',
  'photo-1620799140408-edc6dcb6d633': 'Sạc Dự Phòng',
  'photo-1585060544812-6b45742d762f': 'Sạc Dự Phòng',
  'photo-1586105251261-72a756497a11': 'Giá Đỡ Điện Thoại',
  'photo-1584438784894-089d6a62b8fa': 'Giá Đỡ Điện Thoại',
  'photo-1695048133142-1a20484d2569': 'Điện Thoại iPhone',
  
  // 2. Thời trang Nam
  'photo-1602810318383-e386cc2a3ccf': 'Áo Sơ Mi Nam',
  'photo-1596755094514-f87e34085b2c': 'Áo Sơ Mi Nam',
  'photo-1521572267360-ee0c2909d518': 'Áo Thun Nam',
  'photo-1583743814966-8936f5b7be1a': 'Áo Thun Nam',
  'photo-1594938298603-c8148c4dae35': 'Áo Polo Nam',
  'photo-1581655353564-df123a1eb820': 'Áo Polo Nam',
  'photo-1551028719-00167b16eac5': 'Áo Khoác Bomber',
  'photo-1544441893-675973e31985': 'Áo Khoác Nam',
  'photo-1542272604-787c3835535d': 'Quần Jean Nam',
  'photo-1576995853123-5a10305d93c0': 'Quần Jean Nam',
  'photo-1624378439575-d8705ad7ae80': 'Quần Jogger Nam',
  'photo-1552902865-b72c031ac5ea': 'Quần Jogger Nam',
  'photo-1507679799987-c73779587ccf': 'Quần Tây Nam',
  'photo-1479064555552-3ef4979f8908': 'Quần Tây Nam',
  'photo-1556905055-8f358a7a47b2': 'Áo Hoodie Nam',
  'photo-1509967419530-da38b4704bc6': 'Áo Hoodie Nam',
  'photo-1617137984095-74e4e5e3613f': 'Áo Blazer Nam',
  'photo-1593030761757-71fae45fa0e7': 'Áo Blazer Nam',
  'photo-1591195853828-11db59a44f6b': 'Quần Short Đùi Nam',
  
  // 3. Thời trang Nữ
  'photo-1572804013309-59a88b7e92f1': 'Váy Hoa Nhí / Đầm Maxi',
  'photo-1496747611176-843222e1e57c': 'Váy Hoa Nhí / Đầm Maxi',
  'photo-1566174053879-31528523f8ae': 'Đầm Dự Tiệc',
  'photo-1595777457583-95e059d581b8': 'Đầm Dự Tiệc / Váy Công Chúa',
  'photo-1583496661160-fb5886a0aaaa': 'Chân Váy Chữ A',
  'photo-1582142407894-ec85a1260a46': 'Chân Váy Chữ A',
  'photo-1554412933-514a83d2f3c8': 'Áo Sơ Mi Nữ',
  'photo-1585487000160-6ebcfceb0d03': 'Áo Sơ Mi Nữ',
  'photo-1534528741775-53994a69daeb': 'Áo Croptop Nữ / Set Đồ Bộ',
  'photo-1515886657613-9f3515b0c78f': 'Áo Croptop Nữ / Set Đồ Bộ',
  'photo-1541099649105-f69ad21f3246': 'Quần Jean Nữ / Unisex',
  'photo-1582552938357-32b906df40cb': 'Quần Jean Nữ',
  'photo-1434389677669-e08b4cac3105': 'Cardigan Len',
  'photo-1529139574466-a303027c1d8b': 'Cardigan Len',
  'photo-1539008835657-9e8e9680c956': 'Váy Yếm Kaki',
  
  // 4. Giày dép Nam
  'photo-1542291026-7eec264c27ff': 'Sneaker Nam',
  'photo-1525966222134-fcfa99b8ae77': 'Sneaker Nam / Sneaker Nữ',
  'photo-1614252235316-8c857d38b5f4': 'Giày Tây Nam',
  'photo-1533867617858-e7b97e060509': 'Giày Tây Nam',
  'photo-1560769629-975ec94e6a86': 'Giày Lười Loafer',
  'photo-1539185441755-769473a23570': 'Giày Lười Loafer',
  'photo-1607522370275-f14206abe5d3': 'Dép Quai Ngang / Sandal Nam',
  'photo-1608231387042-66d1773070a5': 'Dép Quai Ngang Nam',
  'photo-1584735935682-2f2b69dff9d2': 'Sandal Nam',
  
  // 5. Giày dép Nữ
  'photo-1543163521-1bf539c55dd2': 'Cao Gót Nữ / Búp Bê',
  'photo-1535043934128-cf0b28d52f95': 'Cao Gót Nữ',
  'photo-1562273138-f46be4ebdf33': 'Búp Bê / Sandal Nữ',
  'photo-1511556532299-8f662fc26c06': 'Sandal Nữ / Dép Bánh Mì',
  'photo-1595950653106-6c9ebd614d3a': 'Sneaker Nữ',
  'photo-1581101767113-1677fc2beaa8': 'Dép Bánh Mì Nữ',
  
  // 6. Đồng hồ
  'photo-1522335789203-aabd1fc54bc9': 'Đồng Hồ Nam / Đồng Hồ Đôi',
  'photo-1533139502658-0198f920d8e8': 'Đồng Hồ Nam',
  'photo-1524805444758-089113d48a6d': 'Đồng Hồ Nữ / Điện Tử',
  'photo-1509042239860-f550ce710b93': 'Đồng Hồ Nữ / Điện Tử',
  'photo-1542496658-e33a6d0d50f6': 'Đồng Hồ Đôi',
  
  // 7. Thiết bị điện tử
  'photo-1505740420928-5e560c06d30e': 'Tai Nghe',
  'photo-1590658268037-6bf12165a8df': 'Tai Nghe',
  'photo-1545454675-3531b543be5d': 'Loa Bluetooth',
  'photo-1608043152269-423dbba4e7e1': 'Loa Bluetooth',
  'photo-1527864550417-7fd91fc51a46': 'Chuột Không Dây',
  'photo-1615663245857-ac93bb7c39e7': 'Chuột Không Dây',
  'photo-1587829741301-dc798b83add3': 'Bàn Phím Cơ',
  'photo-1595225476474-87563907a212': 'Bàn Phím Cơ',
  'photo-1587826080692-f439cd0b70da': 'Webcam',
  
  // 8. Máy tính & Laptop
  'photo-1588872657578-7efd1f1555ed': 'Giá Đỡ Laptop',
  'photo-1553062407-98eeb64c6a62': 'Balo Laptop / Balo Mini',
  'photo-1546938576-6e6a64f317cc': 'Balo Laptop',
  'photo-1707857994017-2b1bf6f4e3fe': 'Miếng Lót Chuột',
  'photo-1760462787834-7b8e39a21009': 'Miếng Lót Chuột',
  'photo-1611186871348-b1ce696e52c9': 'Hub Chuyển Đổi',
  'photo-1628155930542-40a02973843d': 'USB 3.0',
  
  // 9. Máy ảnh
  'photo-1526170375885-4d8ecf77b99f': 'Tripod Chân Máy',
  'photo-1516035069371-29a1b244cc32': 'Tripod Chân Máy',
  'photo-1512790182412-b19e6d62bc39': 'Túi Đựng Máy Ảnh',
  'photo-1495707902641-75cac588d2e9': 'Bộ Vệ Sinh Ống Kính',
  'photo-1502920917128-1aa500764cbd': 'Thẻ Nhớ SD',
  
  // 10. Gia dụng
  'photo-1621972750749-0fbb1abb7736': 'Nồi Chiên Không Dầu',
  'photo-1585659722983-3a675dabf23d': 'Máy Xay Sinh Tố',
  'photo-1578643463396-0997cb5328c1': 'Máy Xay Sinh Tố',
  'photo-1544816155-12df9643f363': 'Nồi Cơm Điện',
  'photo-1584269600464-37b1b58a9fe7': 'Nồi Cơm Điện',
  
  // 11. Nhà cửa & Đời sống
  'photo-1602143407151-7111542de6e8': 'Bình Giữ Nhiệt',
  'photo-1513519245088-0e12902e5a38': 'Bình Giữ Nhiệt',
  'photo-1588854337236-6889d631faa8': 'Kệ Để Gia Vị / Kệ Bếp',
  'photo-1610701596007-11502861dcfa': 'Bộ Bát Đĩa',
  'photo-1513694203232-719a280e022f': 'Đèn Ngủ Thân Gỗ',
  
  // 12. Thể thao
  'photo-1518611012118-696072aa579a': 'Thảm Tập Yoga',
  'photo-1517838277536-f5f99be501cd': 'Bộ Đồ Tập Gym Nữ',
  'photo-1583454110551-21f2fa2afe61': 'Bình Nước Thể Thao',
  'photo-1574680096145-d05b474e2155': 'Bình Nước Thể Thao',
  
  // 13. Mẹ & Bé
  'photo-1555252333-9f8e92e65df9': 'Bình Sữa',
  'photo-1596461404969-9ae70f2830c1': 'Máy Hâm Sữa',
  'photo-1522771930-78848d9293e8': 'Bộ Khăn Xô Sợi Tre',
  'photo-1576435728678-68d0fbf94e91': 'Yếm Ăn Dặm Silicon',
  'photo-1587654780291-39c9404d746b': 'Đồ Chơi Xếp Hình Gỗ',
  'photo-1515488042361-ee00e0ddd4e4': 'Đồ Chơi Xếp Hình Gỗ',
  
  // 14. Sắc đẹp
  'photo-1556228720-195a672e8a03': 'Nước Tẩy Trang / Sữa Rửa Mặt',
  'photo-1620916566398-39f1143ab7be': 'Serum Dưỡng Ẩm',
  'photo-1571781926291-c477ebfd024b': 'Kem Chống Nắng',
  'photo-1522337360788-8b13dee7a37e': 'Kem Chống Nắng / Sữa Rửa Mặt',
  'photo-1586495777744-4413f21062fa': 'Son Kem Lì',
  
  // 15. Sức khỏe
  'photo-1584017911766-d451b3d0e843': 'Máy Đo Huyết Áp',
  'photo-1584308666744-24d5c474f2ae': 'Viên Uống Vitamin',
  'photo-1576091160399-112ba8d25d1d': 'Viên Uống Vitamin',
  
  // 16. Sách & VPP
  'photo-1544716278-ca5e3f4abd8c': 'Sách Đắc Nhân Tâm',
  'photo-1589829085413-56de8ae18c73': 'Sách Tâm Lý Học Về Tiền',
  'photo-1512820790803-83ca734da794': 'Sổ Tay Bìa Da',
  'photo-1532594722383-b75fb8381b55': 'Bộ 10 Bút Gel',
  'photo-1533741761835-c67cadbffd3e': 'Bộ 10 Bút Gel',
  'photo-1583485088034-697b5bc54ccd': 'Bộ 10 Bút Gel',
  'photo-1497633762265-9d179a990aa6': 'Hộp Đựng Bút',
  
  // 17. Túi ví Nữ
  'photo-1584917865442-de89df76afd3': 'Túi Xách Nữ / Balo Nữ Mini',
  'photo-1590874103328-eac38a683ce7': 'Túi Kẹp Nách Nữ',
  'photo-1548036328-c9fa89d128fa': 'Ví Nữ Cầm Tay / Túi Tote',
  'photo-1566150905458-1bf1fc113f0d': 'Ví Nữ Cầm Tay',
  'photo-1594223274512-ad4803739b7c': 'Túi Tote Canvas',
  
  // 18. Phụ kiện Nữ
  'photo-1599643478518-a784e5dc4c8f': 'Dây Chuyền Nữ',
  'photo-1515562141207-7a88fb7ce338': 'Dây Chuyền Nữ',
  'photo-1535632066927-ab7c9ab60908': 'Khuyên Tai Nữ',
  'photo-1511499767150-a48a237f0083': 'Kính Mát Nữ',
  'photo-1534483509719-3feaee7c30da': 'Kính Mát Nữ',
  'photo-1625479969471-c0a79753d2d3': 'Kẹp Tóc Càng Cua',
  'photo-1592931832097-89aca25babf8': 'Kẹp Tóc Càng Cua',
  'photo-1601924994987-69e26d50dc26': 'Khăn Choàng Cổ',
  'photo-1611591437281-460bfbe1220a': 'Khăn Choàng Cổ'
};

async function run() {
  console.log('=== TIẾN HÀNH XÓA CÁC SẢN PHẨM CÓ ẢNH VỚI TÊN KHÔNG TRÙNG NHAU ===');
  const client = await pool.connect();

  try {
    const res = await client.query('SELECT id, name, category, image FROM product."Product"');
    const products = res.rows;
    console.log(`[+] Đọc được ${products.length} sản phẩm trong CSDL.`);

    const toDeleteIds = [];
    const toDeleteSamples = [];

    for (const p of products) {
      const imgId = (p.image || '').match(/photo-[0-9a-f-]+/)?.[0];
      const name = p.name.toLowerCase();

      // 1. Sản phẩm rác, dữ liệu test, không có nghĩa
      if (
        name.includes('test') || 
        name.includes('hle') || 
        name.includes('cuong') || 
        name === 'ghế' || 
        name === 'dép mwc' || 
        (name.includes('sách giáo khoa') && p.category === 'Nhà Cửa')
      ) {
        toDeleteIds.push(p.id);
        if (toDeleteSamples.length < 10) toDeleteSamples.push({ name: p.name, reason: 'Dữ liệu rác/test' });
        continue;
      }

      // 2. Sản phẩm không khớp ảnh
      if (!imgId || !IMAGE_CONTENT[imgId]) {
        // Giữ lại sản phẩm thật đã tạo thủ công chuẩn
        if (p.name.includes('Corsair K70') || p.name.includes('Nón Lưỡi Trai') || p.name.includes('iPhone 15 Pro Max')) {
          // keep
        } else {
          toDeleteIds.push(p.id);
          if (toDeleteSamples.length < 10) toDeleteSamples.push({ name: p.name, reason: 'Ảnh không xác định / rác' });
        }
        continue;
      }

      const expectedKeywords = IMAGE_CONTENT[imgId].toLowerCase().split(' / ');
      const matches = expectedKeywords.some(kw => {
        const parts = kw.split(' ');
        return parts.every(part => name.includes(part));
      });

      if (!matches) {
        toDeleteIds.push(p.id);
        if (toDeleteSamples.length < 10) {
          toDeleteSamples.push({ 
            name: p.name, 
            imageContent: IMAGE_CONTENT[imgId], 
            reason: `Tên "${p.name}" nhưng ảnh là "${IMAGE_CONTENT[imgId]}"` 
          });
        }
      }
    }

    console.log(`\n[!] Tìm thấy ${toDeleteIds.length} sản phẩm không trùng khớp tên và ảnh.`);
    console.log(`[+] Giữ lại ${products.length - toDeleteIds.length} sản phẩm CHÍNH XÁC 100% tên và ảnh.`);
    console.log('\nMẫu các sản phẩm bị xóa:');
    toDeleteSamples.forEach((s, idx) => console.log(`  ${idx + 1}. [${s.name}] -> Lý do: ${s.reason}`));

    if (toDeleteIds.length === 0) {
      console.log('Không có sản phẩm nào cần xóa.');
      return;
    }

    // Bắt đầu Transaction xóa an toàn
    console.log('\n[+] Đang thực hiện Transaction xóa an toàn...');
    await client.query('BEGIN');

    // 1. Xóa các bảng phụ thuộc trong schema product theo từng mẻ (batch) để tránh tràn tham số
    const BATCH_SIZE = 500;
    const depTables = ['FlashSaleItem', 'Review', 'PriceHistory', 'CostPriceHistory', 'ProductLike', 'UserActivity'];

    for (let i = 0; i < toDeleteIds.length; i += BATCH_SIZE) {
      const batch = toDeleteIds.slice(i, i + BATCH_SIZE);

      for (const t of depTables) {
        await client.query(`DELETE FROM product."${t}" WHERE "productId" = ANY($1::text[])`, [batch]);
      }

      // Xóa trong bảng chính product."Product"
      await client.query(`DELETE FROM product."Product" WHERE id = ANY($1::text[])`, [batch]);
      process.stdout.write(`  -> Đã xóa ${Math.min(i + BATCH_SIZE, toDeleteIds.length)} / ${toDeleteIds.length} sản phẩm...\r`);
    }

    await client.query('COMMIT');
    console.log(`\n\n[✔] XÓA THÀNH CÔNG ${toDeleteIds.length} SẢN PHẨM KHÔNG TRÙNG KHỚP!`);

    // Kiểm tra lại số lượng còn lại
    const checkRes = await client.query('SELECT count(*) FROM product."Product"');
    console.log(`[✔] Tổng số sản phẩm chuẩn xác còn lại trong CSDL: ${checkRes.rows[0].count}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Lỗi khi xóa sản phẩm:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

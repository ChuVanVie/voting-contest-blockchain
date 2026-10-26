# voting-contest-blockchain

Smart contract `VotingRegistry` của VoteYourStar, cùng các script mà API Laravel gọi để ghi phiếu lên chuỗi.

**Mục đích:** mỗi phiếu của sự kiện công khai được ghi lại trên chuỗi. Ai cũng tự đối chiếu được số phiếu trên trang với số phiếu trên explorer, và không ai (kể cả nền tảng) sửa hay xóa được phiếu đã ghi.

**Mạng:**
- Hardhat local (chain id 1337) khi phát triển.
- Polygon Amoy testnet (80002) khi chạy thật.
- Mainnet chưa dùng.

## Phiếu nào lên chuỗi

- **Lên chuỗi:** phiếu của sự kiện **công khai** có bật minh bạch (`events.is_transparent`).
- **Không bao giờ lên chuỗi:** khảo sát (poll), sự kiện riêng tư và sự kiện chỉ người được mời. Model `Event` tự tắt minh bạch cho các loại này mỗi khi lưu, nên không đường nào quên được.
- **Không có dữ liệu cá nhân trên chuỗi.** Người bầu chỉ là `voterHash`, tức keccak256 của `userId:eventId:APP_KEY`. `voteHash` thêm lựa chọn và id phiếu.
  - Vì vậy **không được đổi `APP_KEY`** của API: đổi thì hash mới không khớp hash đã ghi.
- **Gói phiếu** (ví dụ 10 phiếu mua một lần) là một bản ghi có `quantity`. Tổng phiếu trên chuỗi cộng theo `quantity`.

## Luồng dữ liệu

1. **Sự kiện:** khi sự kiện công khai minh bạch được tạo hoặc nhân bản, API đẩy job `RegisterEventOnBlockchain`. Job gọi `scripts/register-event.js` để đăng ký sự kiện cùng khung giờ bình chọn.
2. **Phiếu:**
   - Phiếu được lưu vào MySQL trước. Người dùng thấy phiếu được tính ngay.
   - API đẩy job `RecordVoteOnBlockchain` vào queue `blockchain`.
   - Job gọi `scripts/record-vote.js`, script gọi `recordVote` hoặc `recordVotes`, rồi lưu `blockchain_tx_hash` và `blockchain_vote_hash` vào bảng `votes`.
3. **Chỉ một worker** cho queue `blockchain`, vì một ví ký giao dịch tuần tự (nonce). Khóa ví truyền qua biến môi trường `SIGNER_PRIVATE_KEY`, không qua tham số dòng lệnh (`ps` nhìn thấy tham số).
4. **Ghi lỗi thì ghi lại.** `blockchain:reconcile` (mỗi 10 phút) đẩy lại phiếu chưa lên chuỗi, hoặc đánh dấu đã xác minh nếu thực ra đã lên. Job không bao giờ gửi giao dịch thứ hai cho phiếu đã có mã giao dịch.
5. **Giám sát:** `blockchain:monitor` (mỗi 5 phút) kiểm tra:
   - node trả lời và đúng chain;
   - số dư ví signer (`BLOCKCHAIN_ALERT_MIN_BALANCE`);
   - phiếu chờ quá `BLOCKCHAIN_ALERT_BACKLOG_MINUTES`;
   - job lỗi.

   Có vấn đề thì ghi log critical và gửi mail tới `BLOCKCHAIN_ALERT_EMAIL`. Admin xem ở `/admin/blockchain-health`.
6. **Kiểm chứng:**
   - Người bầu mở `/votes/:id/verify` trên web để xem phiếu của mình trên chuỗi.
   - API công khai: `GET /api/v1/blockchain/status`, `/verify-vote/{voteHash}`, `/event/{eventId}`, `/transaction/{txHash}`. `/blockchain/health` chỉ cho admin.

## Contract `VotingRegistry.sol`

Solidity 0.8.24, OpenZeppelin `AccessControl` + `Pausable`. Hàm khởi tạo: `constructor(address admin, address recorder)`.

**Vai trò:**
- `DEFAULT_ADMIN_ROLE`: cấp và thu hồi vai trò, tạm dừng hay mở lại việc ghi. Khi chạy thật nên là multisig.
- `RECORDER_ROLE`: ví của backend, tài khoản duy nhất được ghi.

**Hàm ghi:**
- `registerEvent(eventId, metadataHash, startTime, endTime)`
  - Chỉ `RECORDER_ROLE` gọi được, khi contract không bị tạm dừng.
  - Lỗi nếu sự kiện đã đăng ký, hoặc `startTime >= endTime`.
- `recordVote(eventId, choiceId, voterHash, voteHash)`
  - Chỉ `RECORDER_ROLE`, khi không tạm dừng.
  - Sự kiện phải đang mở và trong khung giờ.
  - Mỗi `voteHash` chỉ ghi một lần. Một người bầu được nhiều phiếu.
- `recordVotes(..., quantity)`: như trên, cho một lần mua gói (1 đến `MAX_QUANTITY` = 1.000.000 phiếu).
- `closeEvent(eventId)`
  - `RECORDER_ROLE` hoặc admin gọi được, kể cả lúc tạm dừng.
  - Sự kiện ngừng nhận phiếu và không đăng ký lại được.
- `pause()` / `unpause()`: chỉ admin. Lúc tạm dừng, ba hàm đăng ký sự kiện và ghi phiếu đều bị chặn.

**Hàm đọc:**
- `verifyVote(voteHash)`: trả eventId, choiceId, voterHash, thời điểm và quantity.
- `events(eventId)` / `getEvent(eventId)`: thông tin sự kiện.
- `getEventVotes(eventId, offset, limit)`: danh sách vote hash, phân trang, `limit` tối đa `MAX_PAGE_SIZE` = 1000.
- `getEventVoteCount(eventId)`: số bản ghi.
- `getEventVoteTotal(eventId)` / `getChoiceVoteCount(eventId, choiceId)`: số phiếu, đã cộng theo quantity.

**Event phát ra:** `EventRegistered`, `VoteRecorded` (kèm quantity), `EventClosed`.

Id sự kiện và lựa chọn phải vừa `uint64`.

## Script

| Script | Ai gọi | Làm gì |
|---|---|---|
| `scripts/deploy.js` | `npm run deploy:amoy` | Deploy lên Amoy, lưu kết quả vào `deployments/` |
| `scripts/deploy-local.js` | `npm run deploy:local`, `start-local.sh` | Deploy lên Hardhat local; admin và recorder mặc định là ví deploy |
| `scripts/register-event.js` | job `RegisterEventOnBlockchain` | Đăng ký một sự kiện |
| `scripts/record-vote.js` | job `RecordVoteOnBlockchain` | Ghi một phiếu hoặc một gói: `SIGNER_PRIVATE_KEY=... node record-vote.js <rpc> <contract> <eventId> <choiceId> <voterHash> <voteHash> [quantity]` |
| `scripts/replay-batch.js` | `php artisan blockchain:replay-local` | Dựng lại chain local từ DB (Hardhat mất dữ liệu khi tắt); bỏ qua cái đã có |
| `scripts/verify.js` | `npm run verify` | Xác minh mã nguồn trên Polygonscan |

## Chạy và test

```bash
npm install
cp .env.example .env      # PRIVATE_KEY (không có 0x), POLYGON_AMOY_RPC, ADMIN_ADDRESS, RECORDER_ADDRESS, POLYGONSCAN_API_KEY
npm run compile
npm test                  # 48 test, test/VotingRegistry.test.js
npm run coverage
```

- **Chain local:** `./start-local.sh` ở thư mục gốc workspace bật Hardhat và tự deploy contract (địa chỉ luôn là `0x5FbD…0aa3`).
  - Khi deploy lại, script tự chạy `blockchain:replay-local` để ghi lại sự kiện và phiếu từ DB.
  - Explorer local: `http://localhost:8000/local-explorer/address/<contract>`.
- **CI:** Jenkins chạy Install, Compile, Test, Coverage, Audit (`Jenkinsfile`).
- **Deploy lên Amoy và cấu hình API:** `voting-contest-infra/DEPLOY.md`, bước A4 và A5.2.
  - Các biến `BLOCKCHAIN_*` và `VOTING_CONTRACT_ADDRESS` nằm trong `backend.env`.
  - App cần `VITE_VOTING_CONTRACT_ADDRESS` và `VITE_BLOCKCHAIN_EXPLORER_URL` lúc build.

**Mạng Amoy:**
- RPC: `https://rpc-amoy.polygon.technology`
- Explorer: `https://amoy.polygonscan.com`
- Faucet: `https://faucet.polygon.technology`

## Bảo mật

- Không commit `.env`, không dán private key vào đâu khác.
- Khóa Hardhat trong `.env` local là khóa công khai của tài khoản #0, chỉ dùng cho chain local.
- Ví dự án chỉ dùng cho dự án. Chạy thật thì `ADMIN_ADDRESS` là multisig, còn ví backend chỉ giữ `RECORDER_ROLE`.

## Gặp lỗi

| Lỗi | Cách xử lý |
|---|---|
| `Insufficient funds` | Ví signer hết POL: nạp thêm từ faucet. `blockchain:monitor` báo trước khi số dư thấp |
| `Nonce too high` / giao dịch kẹt | Chỉ được có một worker queue `blockchain`; kiểm tra không có worker thứ hai |
| `Invalid private key` | Khóa trong `.env` không có tiền tố `0x` |
| Phiếu không lên chuỗi | `docker compose logs queue-blockchain`, `php artisan blockchain:monitor`; xem sự kiện có minh bạch không và đã đăng ký chưa (`php artisan blockchain:register-event --eventId=ID`) |
| Chain local mất sự kiện sau khi tắt | `php artisan blockchain:replay-local` |
| Lỗi biên dịch | `npx hardhat clean` rồi `npx hardhat compile` |

License: MIT.

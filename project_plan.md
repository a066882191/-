# 員工請假系統

## 1. 專案描述

這是一個專為嘉義機務段司機員設計的請假管理系統，支援手機與桌面裝置。系統提供員工線上申請請假、查詢請假紀錄、查看每月班表，以及主管審批、公告管理、員工管理等完整後台功能。

**目標用戶**：嘉義機務段司機員與主管
**核心價值**：簡化請假流程、提升審批效率、透明化班表與請假紀錄、公告即時發布

## 2. 頁面結構

| 頁面路徑 | 說明 | 狀態 |
|----------|------|------|
| `/` | 登入頁面（員工代號 + 密碼）| 完成 |
| `/register` | 新員工註冊 | 完成 |
| `/forgot-password` | 忘記密碼 | 完成 |
| `/reset-password` | 重設密碼 | 完成 |
| `/dashboard` | 員工儀表板（班表預覽、假別統計、快速操作、公告）| 完成 |
| `/leave/apply` | 請假申請（僅限 7 天後至 90 天內）| 完成 |
| `/leave/records` | 請假紀錄查詢（狀態篩選、24h 內取消）| 完成 |
| `/schedule` | 請假班表月曆視圖（按月切換、點擊查看詳情）| 完成 |
| `/shift` | 當月班表圖片查看（A/B 組切換、Google Drive 圖片）| 完成 |
| `/profile` | 個人資料頁面 | 完成 |
| `/admin/approval` | 主管審核（待審核 / 已處理 / 班表圖片 / 導出名單）| 完成 |
| `/admin/announcements` | 公告管理（新增 / 編輯 / 刪除 / 圖片連結）| 完成 |
| `/admin/shift` | 班表連結管理（每月 A/B 組 Google Drive 連結）| 完成 |
| `/admin/employees` | 員工管理（搜尋 / 編輯 / 查看詳情）| 完成 |

## 3. 核心功能

- [x] 員工代號登入驗證（一般員工 / 主管角色）
- [x] 請假申請表單（多種假別、單日請假、工作班輸入）
- [x] 請假紀錄列表（依申請時間排序、五種狀態篩選）
- [x] 24 小時內取消申請機制
- [x] 主管審批功能（核准 / 駁回、審核意見、雙層月份/日期摺疊）
- [x] 已處理紀錄查詢（雙層月份/日期摺疊縮放）
- [x] 每月班表月曆視圖（查看請假狀態）
- [x] 假別統計（剩餘天數、已用天數圓環圖）
- [x] 班表圖片管理（每月 A/B 組 Google Drive 連結儲存）
- [x] 公告管理（圖片 / 文字公告、增刪改）
- [x] 員工管理（編輯資料、組別、假別天數）
- [x] 請假名單導出 Excel（月曆總表 + 詳細列表）
- [x] 請假名單導出 PDF（自動分頁高解析度截圖）
- [x] 本周班表自定義（循環班次點擊切換、圖片匯出分享）
- [x] 班表圖片匯出 / 分享（Web Share API）
- [x] 行動裝置響應式設計（底部導航列）
- [x] 多語系支援（i18n 繁體中文）

## 4. 資料模型設計

### Table: employees（員工資料）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| employee_code | text | 員工代號（登入帳號）|
| name | text | 員工姓名 |
| role | text | 角色：employee / manager |
| title | text | 職稱 |
| group | text | 組別：A / B |
| annual_leave_days | integer | 特休剩餘天數 |
| sick_leave_days | integer | 病假剩餘天數 |
| phone_home | text | 家中電話 |
| phone_mobile | text | 手機號碼 |
| email | text | 電子郵件 |
| gender | text | 性別 |
| hire_date | date | 入職日 |
| status | text | 帳號狀態：active / inactive |
| created_at | timestamp | 建立時間 |

### Table: leave_requests（請假申請）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | uuid | 主鍵 |
| employee_id | uuid | 申請人ID |
| employee_name | text | 申請人姓名（快照）|
| leave_type | text | 假別類型 |
| leave_type_name | text | 假別名稱（快照）|
| start_date | date | 開始日期 |
| end_date | date | 結束日期 |
| start_time | time | 開始時間 |
| end_time | time | 結束時間 |
| days_count | integer | 請假天數 |
| reason | text | 請假事由 |
| work_shift | text | 當天工作班 |
| status | text | 狀態：pending / approved / rejected / cancelled |
| approver_id | uuid | 審核人ID |
| approver_comment | text | 審核意見 |
| created_at | timestamp | 申請時間 |
| updated_at | timestamp | 更新時間 |

### Table: shift_monthly_images（每月班表圖片）
| 欄位 | 類型 | 說明 |
|------|------|------|
| year | integer | 年份 |
| month | integer | 月份 |
| a_group_url | text | A 組 Google Drive 圖片連結 |
| b_group_url | text | B 組 Google Drive 圖片連結 |
| updated_at | timestamp | 更新時間 |

### Table: announcements（公告）
| 欄位 | 類型 | 說明 |
|------|------|------|
| id | text | 主鍵 |
| title | text | 公告標題 |
| image_url | text | 圖片連結 |
| date | text | 發布日期 |
| manager | text | 發布人 |
| created_at | timestamp | 建立時間 |

## 5. 後端 / 第三方整合

- **Supabase**：已連接
  - 身份驗證（Auth）：員工代號 + 密碼登入
  - 資料庫（Database）：employees、leave_requests、shift_monthly_images、announcements
  - Row Level Security（RLS）：已啟用
- **Shopify**：不需要
- **Stripe**：不需要

## 6. 技術棧

- React 19 + TypeScript + Vite
- Tailwind CSS 3
- React Router DOM 7
- Supabase JS Client
- i18next（繁體中文）
- xlsx-js-style（Excel 導出）
- jspdf + html-to-image（PDF 導出）
- Remix Icon + Font Awesome

## 7. 開發階段計畫（已完成）

### Phase 1: 登入系統 + 基礎頁面架構
- 登入頁、註冊頁、忘記密碼、重設密碼
- 底部導航列、響應式布局
- 角色權限區分（employee / manager）

### Phase 2: 儀表板與請假申請
- 儀表板（假別統計卡片、本周班表預覽、公告輪播）
- 請假申請表單（13 種假別、日期限制、工作班輸入）
- 請假紀錄列表（五種狀態篩選、24h 取消機制）

### Phase 3: 主管後台
- 審核管理（待審核 / 已處理 / 班表圖片 / 導出名單）
- 員工管理（搜尋、編輯、詳情彈窗）
- 公告管理（圖片 / 文字公告增刪改）

### Phase 4: 班表與排班
- 每月班表圖片查看（A/B 組切換）
- 請假班表月曆（彩色狀態標示）
- 班表連結管理（每月 Google Drive 連結儲存）
- 本周班表自定義（循環班次點擊切換、圖片匯出分享）

### Phase 5: 進階功能
- Excel 導出（月曆總表 + 詳細列表，標楷體格式）
- PDF 導出（自動分頁高解析度截圖）
- 雙層月份 / 日期摺疊審核列表
- Google Drive 圖片自動轉換（透過 Edge Function 代理）
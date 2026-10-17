# Аудит безопасности `bedolaga-cabinet` (ветка `my-h0pp-cabinet`), октябрь 2026

**Коммит:** `954960b` · **Режим:** только чтение кода, без запуска приложения и без обращений к продакшену · **Дата:** 2026-10-17

## 0. Границы аудита

Это репозиторий **только фронтенда** (React + Vite SPA, статика за Caddy). Бэкенд — Cabinet API бота
(`OneShotov/h0pp-bot`) — в этом репозитории отсутствует. Поэтому:

- всё, что реально защищает деньги и данные (проверка владельца по ID, статусы платежей, подпись вебхуков
  платёжек, CORS, срок жизни JWT, лимиты попыток), **находится на бэкенде и здесь не проверялось**;
  список того, что надо проверить в боте, — в разделе 4;
- заголовки безопасности продакшена задаёт Caddy (`/home/tgbot/caddy-gateway/Caddyfile`, вне репо) —
  не проверялись;
- `docker-compose.local.yml` (прод-оверрайд) намеренно не в git — не проверялся.

Обозначения в тексте: **[факт]** — видно в коде; **[вывод]** — моё заключение из фактов;
**[гипотеза]** — требует проверки на живой системе или в коде бота.

## 1. Сводная таблица находок

| № | Уровень | Находка | Где |
|---|---|---|---|
| К-1 | **Критично** | Токен покупки в URL без входа открывает e-mail, **пароль** кабинета, auto-login-токен и ссылку подписки; URL и сам пароль уходят в Яндекс.Метрику (webvisor), логи прокси и историю браузера | `src/App.tsx:319-326`, `src/api/landings.ts:132-153,299-301`, `src/pages/PurchaseSuccess.tsx:143,742`, `src/hooks/useAnalyticsCounters.ts:26-37` |
| В-1 | Важно | Одноразовые токены (подтверждение e-mail, сброс пароля, авто-вход, merge, подарки, купоны) остаются в URL страницы → аналитика, история, логи | `src/pages/VerifyEmail.tsx:30`, `src/pages/ResetPassword.tsx:13`, `src/pages/AutoLogin.tsx:16`, `src/pages/GiftClaim.tsx:66-67`, `src/pages/MergeAccounts.tsx:268`, `src/pages/CouponStatus.tsx:37` |
| В-2 | Важно | Экран результата пополнения верит статусу из URL (`?status=paid`, `?success=true`) и не сверяется с бэкендом | `src/pages/TopUpResult.tsx:192-207,283-289` |
| В-3 | Важно | Access-токен передаётся в query-строке WebSocket-URL (`?token=…`) | `src/providers/WebSocketProvider.tsx:15,76` |
| В-4 | Важно | Refresh-токен хранится в `localStorage` (и в Telegram CloudStorage) без ротации; профиль пользователя (e-mail, telegram_id, баланс) тоже в `localStorage` | `src/utils/token.ts:25-30,99-114,252-270`, `src/store/auth.ts:424-435` |
| В-5 | Важно | В `nginx.conf` нет ни одного заголовка безопасности (CSP, X-Content-Type-Options, Permissions-Policy, frame-ancestors); сторонние скрипты и inline-скрипты без CSP | `nginx.conf`, `index.html:26-45`, `src/hooks/useAnalyticsCounters.ts:14-62` |
| В-6 | Важно | CI, CodeQL, npm audit и Trivy запускаются только для `main`/`dev` — рабочая ветка форка `my-h0pp-cabinet` вообще не проверяется; npm audit и Trivy не блокируют сборку | `.github/workflows/ci.yml:5-7`, `codeql.yml:5-7`, `security-audit.yml:5-7,34`, `docker.yml:5-9,93` |
| Ж-1 | Желательно | Метрика с `webvisor:true` + `clickmap` + `trackLinks` пишет сессии (e-mail на форме входа, баланс, переписка с поддержкой) третьей стороне; мёртвая ветка кода читает токен из `localStorage` | `src/hooks/useAnalyticsCounters.ts:31-36,132` |
| Ж-2 | Желательно | `linkifyText` пропускает `<a>`, написанные самим пользователем: текст ссылки ≠ адрес (фишинг админа из чата поддержки), `target` без `rel` | `src/utils/linkify.ts:20-27`; рендер в `src/pages/AdminTickets.tsx:565`, `src/pages/Support.tsx:609`, `src/components/admin/userDetail/TicketsTab.tsx:242` |
| Ж-3 | Желательно | Санитайзеры HTML разрешают `class`, `style`, `<img src>` с любого хоста; regex-«санитайзер» custom CSS лендинга обходится | `src/utils/legalContent.ts:35`, `src/pages/Info.tsx:77-145`, `src/pages/QuickPurchase.tsx:953-980` |
| Ж-4 | Желательно | URL от бэкенда/админки подставляются в `href`/`location.href` без проверки схемы | `src/pages/QuickPurchase.tsx:1007`, `src/pages/Login.tsx:175`, `src/pages/ConnectedAccounts.tsx:545`, `src/utils/openPaymentUrl.ts:22`, `src/components/connection/InstallationGuide.tsx:323`, `src/pages/GiftClaim.tsx:271`, `src/pages/CouponStatus.tsx:156`, `src/pages/AdminPayments.tsx:510` |
| Ж-5 | Желательно | Выход не очищает кэш react-query; две `window.open` без `noopener` | `src/store/auth.ts:114-128`, `src/pages/Wheel.tsx:363`, `src/platform/adapters/WebAdapter.ts:203` |
| Ж-6 | Желательно | Регистрация раскрывает, занят ли e-mail; сырые объекты ошибок axios (с initData/заголовками) пишутся в консоль в проде | `src/pages/Login.tsx:323-324`, `src/pages/TelegramRedirect.tsx:106`, `src/pages/Login.tsx:217` |
| Ж-7 | Желательно | Адрес возврата после входа не прогоняется через `getSafeRedirectPath` (путь эксплуатации не найден — только defense-in-depth) | `src/pages/Login.tsx:98-111`, `src/utils/token.ts:316-332` |
| Ж-8 | Желательно | `npm audit`: 6 high + 2 moderate — все в **dev-зависимостях сборки** (toolchain Tailwind 3), в рантайм-бандл не попадают | `package-lock.json` |
| Ж-9 | Желательно | `location /api/` в `nginx.conf` без `proxy_pass` отдаёт `index.html`; версия nginx не скрыта | `nginx.conf:24-31` |

## 2. Детали находок

### К-1. Токен покупки в URL = учётные данные кабинета без входа

**[факт]** Маршрут `/buy/success/:token` публичный (`src/App.tsx:319-326`). Страница по токену из пути
опрашивает `GET /cabinet/landing/purchase/{token}` (`src/api/landings.ts:299-301`); префикс
`/cabinet/landing/` входит в `AUTH_ENDPOINTS` (`src/api/client.ts:67`), поэтому запрос идёт **без Bearer**.
Ответ `PurchaseStatus` (`src/api/landings.ts:132-153`) содержит `cabinet_email`, **`cabinet_password`**,
`auto_login_token`, `subscription_url`, `subscription_crypto_link`. Пароль рендерится открытым текстом в
`CopyableField` (`src/pages/PurchaseSuccess.tsx:143`), токен сохраняется в `localStorage`
(`ym_buy_success_${token}`, строка 742).

**[факт]** `useAnalyticsCounters()` подключён на уровне `App` (`src/App.tsx:285`), то есть на этой странице
тоже. Метрика инициализируется с `webvisor:true, clickmap:true, trackLinks:true`
(`src/hooks/useAnalyticsCounters.ts:31-36`); Метрика отправляет полный URL страницы и записывает DOM.
Страница ставит `<meta name="referrer" content="no-referrer">` (строка 678) — это закрывает утечку через
`Referer`, но не через аналитику, access-логи прокси и историю браузера.

**[вывод]** Любой, кто видит URL (история/закладки на общем устройстве, access-лог Caddy, аккаунт Метрики
или Google Ads, пересланное письмо), получает пароль кабинета и VPN-ссылку, пока пользователь не сменит
пароль. При включённой Метрике пароль дополнительно виден в Вебвизоре. Без Метрики и без доступа к логам
уровень — «важно»; с ними — критично.

**[гипотеза]** Является ли токен одноразовым и каков его TTL — определяется ботом; в коде кабинета страница
опрашивает его повторно (polling), значит токен многоразовый как минимум несколько минут.

**Как воспроизвести без вреда.** На своём тестовом лендинге сделать тестовую покупку (или попросить бота
создать тестовую запись). После редиректа скопировать URL `/buy/success/<token>`, открыть его в приватном
окне без входа — виден e-mail/пароль. В DevTools → Network посмотреть запрос к `mc.yandex.ru` (если счётчик
включён): в параметрах есть `page-url` с токеном. Проверить access-лог Caddy на наличие этого пути.

**Как исправить.**
- Фронтенд: не поднимать аналитику на маршрутах `/buy/*`, `/auto-login`, `/verify-email`,
  `/reset-password`, `/auth/*`, `/merge/*`, `/coupon/*` (условие в `useAnalyticsCounters` по
  `location.pathname`) или инициализировать Метрику с `webvisor:false` и передавать обезличенный `url`;
  обернуть блок с учётными данными в `class="ym-hide-content"`; показывать пароль маскированно с кнопкой
  «показать»; после первого успешного ответа убрать токен из адресной строки `history.replaceState` и держать
  его в состоянии компонента; не писать токен в `localStorage` (хватит хэша).
- Бэкенд (бот): не отдавать `cabinet_password` по GET; показывать пароль один раз в ответ на POST активации,
  после чего поле обнулять; короткий TTL и привязка токена к сессии/cookie; `auto_login_token` — строго
  одноразовый.

### В-1. Одноразовые токены остаются в URL

**[факт]** `VerifyEmail` читает `?token=` и не чистит адрес (`src/pages/VerifyEmail.tsx:30`);
`ResetPassword` держит токен в URL всё время заполнения формы (`src/pages/ResetPassword.tsx:13`);
`AutoLogin` — `?token=` (`src/pages/AutoLogin.tsx:16`), на него же ведёт `GiftClaim`
(`src/pages/GiftClaim.tsx:66-67`); `MergeAccounts`, `GiftClaim`, `CouponStatus` — токен в пути.
Для сравнения, `OAuthCallback` (`:78`) и `LinkTelegramCallback` (`:22`) сразу делают `replaceState` —
правильно.

**[вывод]** Эти URL попадают в Метрику/gtag (хит с полным адресом), в историю браузера и в логи прокси.
Для сброса пароля токен живёт до использования — обладатель лога может задать пароль жертве в этом окне.

**Воспроизвести:** открыть ссылку сброса из письма на тестовом аккаунте, в Network посмотреть хит Метрики;
нажать «назад» — токен в истории.

**Исправить:** читать токен в `useState(() => …)` и немедленно `history.replaceState(null, '',
location.pathname)`; не монтировать аналитику на этих маршрутах; на бэкенде — передавать токен во фрагменте
`#token=` (не уходит в логи сервера) или только через POST-форму.

### В-2. Статус оплаты из URL принимается на веру

**[факт]** `TopUpResult` считает платёж успешным, если в URL `?status=<paid-статус>` или `?success=true`
(`src/pages/TopUpResult.tsx:192-196`), и в этом случае **отключает** опрос бэкенда (`:200-207`), а
`resolvedPaid` ставится из URL (`:283-286`): показывается «Оплата успешна», инвалидируются запросы баланса.

**[вывод]** Баланс не меняется (его считает бэкенд), поэтому денег этим не украсть. Но пользователь (или
мошенник со скриншотом «успешной оплаты» в споре с поддержкой) видит ложный успех; при реально отклонённом
платеже с `status=success` от платёжки в return-URL пользователь не узнает о проблеме.

**Воспроизвести:** войти в тестовый аккаунт, открыть `/balance/top-up/result?status=paid` — экран успеха.

**Исправить:** URL-параметры использовать только как подсказку для UI «ожидаем подтверждение»; успех
показывать исключительно при `is_paid === true` из `/cabinet/balance/pending-payments/...`; при
расхождении статуса URL и бэкенда — показывать «проверяем».

### В-3. Access-токен в query WebSocket

**[факт]** `buildWebSocketUrl` добавляет `?token=<access_token>` (`src/providers/WebSocketProvider.tsx:15`).

**[вывод]** URL WebSocket-рукопожатия целиком попадает в access-лог Caddy/nginx и в любые промежуточные
прокси; токен живёт до `exp`.

**Исправить:** авторизовать соединение первым сообщением `{type:'auth', token}` после `onopen`, либо
передавать токен в `Sec-WebSocket-Protocol`, либо получать короткоживущий одноразовый ws-ticket POST-запросом.
Требует согласованной правки бота.

### В-4. Хранение токенов

**[факт]** Access — в `sessionStorage`, refresh — в `localStorage` и зеркалом в Telegram CloudStorage
(`src/utils/token.ts:107-114`, `:25-30`). При обновлении клиент берёт из ответа только `access_token`
(`:263-267`), хотя тип `TokenResponse` содержит `refresh_token` (`src/types/index.ts:48-53`).
Zustand-persist кладёт объект `user` (e-mail, telegram_id, баланс) в `localStorage` под ключом
`cabinet-auth` (`src/store/auth.ts:433-435`).

**[вывод]** Любой XSS или вредоносное расширение браузера получает долгоживущую сессию; ротация refresh-токена
бэкендом сейчас сломала бы клиент, значит её, вероятно, нет **[гипотеза — проверить в боте]**.
XSS в аудите не найден, поэтому это укрепление, а не дыра.

**Исправить:** на бэкенде выдавать refresh в `HttpOnly; Secure; SameSite=Strict` cookie с ротацией и
детекцией повторного использования; если cookie невозможна (Mini App), хотя бы ротация + клиент сохраняет
новый `refresh_token` из ответа; `partialize` без e-mail/баланса (их и так тянет `/cabinet/auth/me`).

### В-5. Заголовки безопасности и CSP

**[факт]** `nginx.conf` задаёт только кеширование. `index.html` грузит Google Fonts, внутри Telegram —
`telegram.org/js/telegram-web-app.js`, содержит четыре inline-скрипта; виджет входа грузит
`telegram.org/js/telegram-widget.js?23` и `oauth.telegram.org/js/telegram-login.js?3`; аналитика —
`mc.yandex.ru`, `googletagmanager.com`. Продакшен-заголовки, если есть, заданы в Caddyfile вне репо —
**не проверено**.

**Исправить (в Caddyfile кабинета, и продублировать в `nginx.conf` образа):**
`Content-Security-Policy` с `script-src 'self' https://telegram.org https://oauth.telegram.org
https://mc.yandex.ru https://www.googletagmanager.com 'sha256-…'` (хэши четырёх inline-скриптов или вынести
их в файл), `connect-src 'self' https://mc.yandex.ru wss:`, `frame-ancestors 'self' https://web.telegram.org
https://*.telegram.org` (**не** `DENY` — Mini App в web-Telegram открывается во фрейме), `img-src 'self'
data: https:`; `X-Content-Type-Options: nosniff`; `Referrer-Policy: strict-origin-when-cross-origin`;
`Permissions-Policy: camera=(self), geolocation=()` (камера нужна QR-сканеру); `server_tokens off`.
Проверять через `curl -I https://<кабинет>/`.

### В-6. Проверки не запускаются на рабочей ветке форка

**[факт]** Все workflow триггерятся на `push`/`pull_request` в `main`/`dev`. Правило проекта — не коммитить
в `main`, работать в `my-h0pp-cabinet`, поэтому на ваши коммиты не запускаются ни тесты, ни CodeQL, ни
`npm audit`, ни Trivy. `npm audit` помечен `continue-on-error: true`, Trivy — `exit-code: "0"`.

**Исправить:** добавить `my-h0pp-cabinet` в `branches:` четырёх workflow (или `branches: ['**']` для
CodeQL/audit); для `npm audit` оставить non-blocking только для dev-зависимостей
(`npm audit --omit=dev --audit-level=high` как блокирующий шаг).

### Ж-1. Персональные данные в сторонней аналитике

**[факт]** Вебвизор пишет сессии целиком; отдельных исключений для форм (`ym-disable-keys`,
`ym-hide-content`) в разметке нет (поиск по `ym-` в `src/` — пусто). Строка 132 читает
`localStorage.getItem('access_token')`, но access-токен с миграции лежит в `sessionStorage` → ветка
синхронизации ClientID никогда не выполняется (функциональная ошибка, не уязвимость).

**Исправить:** `webvisor:false` или пометить поля e-mail/баланс/чат; упомянуть Метрику в политике
конфиденциальности; удалить мёртвую ветку (строки 130-136) или читать через `tokenStorage`.

### Ж-2. `linkifyText` и пользовательские `<a>`

**[факт]** Текст сообщения сначала оборачивается в `<a>` по regex, затем проходит DOMPurify с разрешёнными
`a`, `br` и атрибутами `href`, `target`, `rel`. Готовые теги `<a href="https://evil" target="_blank">
https://bank.example</a>` из текста пользователя сохраняются как есть: текст и адрес разные, `rel` нет.
`javascript:` DOMPurify блокирует — XSS нет.

**Воспроизвести:** отправить такое сообщение в поддержку с тестового аккаунта и посмотреть в
`/admin/tickets`.

**Исправить:** экранировать `<`, `>`, `&` в тексте до линкификации, либо рендерить React-элементами без
`dangerouslySetInnerHTML`; в хуке DOMPurify принудительно ставить `rel="noopener noreferrer"`.

### Ж-3. Широкие allowlist санитайзеров и CSS лендинга

**[факт]** `sanitizeHtml` разрешает `class`, `div`, `span` (`legalContent.ts:35`); `RICH_SANITIZE_CONFIG`
разрешает `class`, `style` (сужен хуком до `text-align`), `img src` с любого хоста (`Info.tsx:77-145`).
Regex-санитайзер `custom_css` удаляет `content:…;` только с `;` на конце (`QuickPurchase.tsx:968`), так что
`content:"текст"}` проходит. Контент во всех случаях пишет **администратор** через бота.

**[вывод]** Риск — только при компрометации админки: класс-инъекция (Tailwind-оверлей `fixed inset-0`),
трекинг-пиксели читателей, подмена текста через `::before`.

**Исправить:** убрать `class` из allowlist или оставить список допустимых классов; для `img` — хук с
проверкой хоста; custom CSS прогонять через парсер (например `postcss-safe-parser`) или отказаться от него.

### Ж-4. Схемы URL от бэкенда не проверяются

**[факт]** В перечисленных местах значения `payment_url`, `authorize_url`, `tutorialUrl`, `bot_link`,
`channel_link` идут в `href`/`location.href` без фильтра. Источник — собственный бэкенд и админка (доверенный).
Для сравнения, `BlockButtons.tsx:10` и `openAppScheme.ts:41-42` проверку делают.

**Исправить:** одна функция `isSafeHttpUrl(url)` (`https?:`, `tg:`) и применять её во всех местах.

### Ж-5. Выход и `window.open`

**[факт]** `logout()` чистит токены и стор, но нигде нет `queryClient.clear()`; страница не перезагружается.
`Wheel.tsx:363` открывает `about:blank` и потом подставляет `invoice_url` — у новой вкладки остаётся `opener`;
`WebAdapter.openInvoice` (`:203`) — `window.open` без `noopener`.

**Исправить:** в `logout` вызывать `queryClient.clear()` (или `navigate('/login')` с reload); после
`window.open` ставить `win.opener = null`.

### Ж-6. Перечисление e-mail и логи ошибок

**[факт]** При регистрации бэкенд отвечает 400 «already registered», и фронтенд показывает «e-mail уже
зарегистрирован» (`Login.tsx:323-324`) — можно проверить, есть ли аккаунт. Форма «забыли пароль» отвечает
нейтрально — правильно. `console.error('Telegram auth failed:', err)` (`TelegramRedirect.tsx:106`) выводит
объект axios с телом запроса (`init_data`) — только в локальную консоль.

**Исправить (бэкенд):** при занятом e-mail отвечать так же, как при успехе («письмо отправлено»), а письмо
слать владельцу. Фронтенд: логировать `getApiErrorMessage(err)`, а не объект.

### Ж-7. Адрес возврата после входа

**[факт]** `getReturnUrl` берёт `location.state.from` или сохранённый `pathname+search` и передаёт в
`navigate` без `getSafeRedirectPath`. Я проверил сценарий `https://кабинет//evil.com/...`: такой pathname не
совпадает ни с одним защищённым маршрутом (попадает в `*` → `/`), поэтому `saveReturnUrl` с чужим хостом не
вызывается. Эксплуатации не нашёл; оставлено как единообразие.

**Исправить:** `navigate(getSafeRedirectPath(getReturnUrl()))`.

### Ж-8. Зависимости

**[факт]** `npm audit` (lockfile v3, 435 пакетов): 8 находок — `braces`, `micromatch`, `fast-glob`,
`chokidar`, `postcss-selector-parser`, `postcss-nested`, `source-map-js`, `tailwindcss` (все dev,
транзитивно через Tailwind 3; тип — DoS при сборке). Рантайм: `axios 1.20.0`, `dompurify 3.4.16`,
`react 19.3.0`, `react-router 8.4.0`, `zustand 5.0.15` — без известных уязвимостей по данным audit.
Dependabot настроен (npm, actions, docker, еженедельно).

**Исправить:** `npm audit fix` закрывает `fast-glob`, `source-map-js`, `postcss-nested`; остальное — только
миграцией на Tailwind 4 (major). Не срочно.

### Ж-9. nginx

**[факт]** `location /api/` содержит `try_files $uri /index.html` и заголовки прокси, но нет `proxy_pass` —
при прямом использовании образа без внешнего прокси запросы к API вернут HTML 200. В проде перед образом
стоит Caddy, поэтому это не влияет; но блок вводит в заблуждение. `server_tokens` не выключен.

## 3. Проверено и чисто

**Авторизация и сессии**
- Все `dangerouslySetInnerHTML` (20 мест) идут через DOMPurify: `NewsArticle`, `Info`, `InfoPageView`,
  `PublicLegal`/`AppShell` (через `formatContent → sanitizeHtml`), `AdminUpdates`, `QuickPurchase`,
  `linkifyText`, SVG-иконки (`InstallationGuide.tsx:98`, профиль `svg`). `eval`, `new Function`,
  `document.write`, слушателей `message` — нет.
- `iframe` только `https://` с хостов YouTube/Vimeo, `style` сужен до `text-align`, `data-*` запрещены.
- Open redirect: `?redirect=`/`returnTo` через `getSafeRedirectPath` (`TelegramRedirect`, `TopUpAmount`);
  `openAppScheme.ts:41-42`, `public/miniapp/redirect.html:141-148`, `DeepLinkRedirect.tsx:40-51` блокируют
  `javascript:`/`data:`/`http(s):`/`intent:` и пропускают только схемы VPN-клиентов.
- OAuth: `state` генерируется бэкендом, хранится в `sessionStorage`, сверяется на колбэке, `code`/`state`
  стираются из URL (`OAuthCallback.tsx:61-78`); привязка Telegram — проверка `csrf_state`
  (`LinkTelegramCallback.tsx:26-34`); если `sessionStorage` недоступен, переход на провайдера не делается
  (`oauth.ts:17-21`).
- Виджет Telegram грузится только с `telegram.org`/`oauth.telegram.org` с зафиксированной версией; подпись
  `hash` проверяет бэкенд.
- initData берётся свежим (`telegramInitData.ts`), при смене Telegram-пользователя сессия сбрасывается
  (`token.ts:181-203`).
- Access-токен не в URL (кроме В-3), только `Authorization: Bearer`; auth-эндпоинты без Bearer; 401 →
  одна попытка refresh → `/login`; сбой сети не стирает сессию.
- Выход вызывает `POST /cabinet/auth/logout` с refresh-токеном и чистит `sessionStorage`, `localStorage`,
  CloudStorage (`store/auth.ts:114-128`, `token.ts:124-134`).
- Пароль: минимум 8 символов на клиенте, корректные `autoComplete`, не логируется, не попадает в URL;
  сброс — токен + двойной ввод. «Забыли пароль» — нейтральный ответ.
- CSRF: авторизация по Bearer, cookie сессии нет → классический CSRF неприменим; дополнительный
  double-submit `csrf_token` (`client.ts:17-38,130`) безвреден.

**IDOR, платежи, формы (клиентская часть)**
- Цена **не** отправляется клиентом: покупка/продление/трафик/устройства шлют только `tariff_id`,
  `period_days`, `gb`, `devices`, `subscription_id` (`subscription.ts`, `landings.ts:106-125`); сумма
  пополнения `amount_kopeks` — единственное числовое поле от клиента (мин/макс должен проверять бэкенд).
- Промокоды, реферальные коды и слаги кампаний: regex `^[a-zA-Z0-9_-]{1,64}$`, TTL 24 ч, параметр
  удаляется из URL (`referral.ts`, `campaign.ts`); промокод отправляется как есть и проверяется бэкендом.
- Загрузка в поддержку: только `image/jpeg|png|gif|webp`, ≤ 10 МБ на клиенте (`Support.tsx:120-122`);
  медиа отдаются по подписанному истекающему токену (`tickets.ts:84-88`).
- Трекер активности отправляет путь без query/фрагмента и не пишет набираемый текст (`activity.ts:7`,
  `activityTracker.ts`).
- Маскирование секретов в админ-настройках (`adminSettings.ts:38-40`).

**Секреты и сборка**
- В репозитории и во всей истории (614 коммитов) нет `.env`, ключей, токенов ботов, GitHub-токенов,
  приватных ключей; есть только `.env.example`. `.env`, `docker-compose.local.yml`, `CLAUDE.md` — в
  `.gitignore`.
- В бандл попадают только `VITE_API_URL`, `VITE_TELEGRAM_BOT_USERNAME`, `VITE_APP_NAME`, `VITE_APP_LOGO`,
  `VITE_HEALTH_URL` — публичные значения. `sourcemap: false`. Логгер пишет только в dev (кроме Ж-6).
- Inline-скрипты `index.html` валидируют данные из `localStorage` (regex на имена/значения CSS-переменных,
  префикс `data:image/png;`, запись через `textContent`/`document.title`).
- `useSiteVerification` ставит значение через `setAttribute` — HTML не парсится.
- Dockerfile многостадийный, `.dockerignore` исключает `.env`; CodeQL и Trivy настроены (но см. В-6).

## 4. Что проверить на бэкенде (`h0pp-bot`, вне этого репо)

1. **IDOR:** `GET/DELETE /cabinet/subscriptions/{id}`, `?subscription_id=` во всех `/cabinet/subscription/*`,
   `/cabinet/tickets/{id}`, `/cabinet/balance/saved-cards/{id}`,
   `/cabinet/balance/pending-payments/{method}/{id}`, `/cabinet/referral/withdrawal/{id}/cancel`,
   `/cabinet/subscription/devices/{hwid}` — каждый должен фильтроваться по `user_id` из JWT.
   Проверка: двумя тестовыми аккаунтами подставить ID чужого объекта — ожидается 403/404.
2. **Платежи:** вебхуки платёжек проверяют подпись и сумму против записи платежа; `return_url` статус не
   влияет на начисление; `amount_kopeks` ограничен мин/макс; идемпотентность вебхука.
3. **Токены лендинга:** энтропия, TTL и одноразовость `purchase token`/`auto_login_token`; не отдавать
   пароль по GET (К-1).
4. **JWT:** срок жизни access/refresh (`CABINET_JWT_*`), ротация refresh, отзыв при logout; максимальный
   возраст initData — по комментарию в `telegramInitData.ts:16` это 30 суток, что много для replay.
5. **CORS:** `CABINET_ALLOWED_ORIGINS` = только домен кабинета, без `*`.
6. **Лимиты:** вход по e-mail, «забыли пароль», активация промокода, `/cabinet/auth/deeplink/poll` —
   клиентский `rateLimit.ts` лишь косметика.
7. **Ответы ошибок:** регистрация не должна раскрывать существование e-mail (Ж-6).

## 5. Методика

Ручное чтение `src/` (≈1000 файлов, акцент на `api/`, `store/`, `utils/`, `pages/*Callback*`, платёжные
страницы, все места `dangerouslySetInnerHTML`/`window.open`/`location.href`/`localStorage`), `index.html`,
`nginx.conf`, `Dockerfile`, `docker-compose.yml`, `vite.config.ts`, `.github/workflows/*`; поиск секретов по
паттернам в рабочем дереве и `git log --all -p`; `npm audit --json` по `package-lock.json`. Приложение не
запускалось, продакшен не трогался.

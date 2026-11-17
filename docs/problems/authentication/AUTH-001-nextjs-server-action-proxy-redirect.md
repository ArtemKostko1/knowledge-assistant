# AUTH-001 — Несовместимый Proxy redirect при вызове Server Action после смены сессии

## Метаданные

- **ID:** AUTH-001
- **Название:** Next.js Proxy возвращает обычный redirect для Server Action при устаревшей сессии между вкладками
- **Обнаружена:** Stage C Authentication; точная дата обнаружения в исходных данных не указана
- **Документирована:** 2026-11-17
- **Компонент / подсистема:** Web Authentication, Next.js App Router / Proxy / Server Actions
- **Стек и версии:** Next.js 16.4.3, React 19.3.1, `@supabase/ssr` ^0.12.7, Supabase SSR cookies, Chrome; локальный `pnpm dev:local`
- **Severity:** Medium
- **Status:** Verified
- **Связанные файлы:**
  - `apps/web/src/proxy.ts`
  - `apps/web/src/config/access-policy.ts`
  - `apps/web/src/config/routes.ts`
  - `apps/web/src/features/application/actions/logout.ts`
  - `apps/web/src/features/application/ui/logout-button.tsx`
  - `apps/web/src/app/(protected)/layout.tsx`
  - `apps/web/src/app/(protected)/app/page.tsx`
  - `apps/web/src/proxy.test.ts`
- `apps/web/src/features/application/actions/logout.test.ts`

Версия Chrome и точная версия pnpm в диагностике не указаны.

## Контекст

Web-приложение использует Next.js App Router и Supabase SSR cookies. Cookies общие для вкладок одного профиля браузера; отдельные per-tab sessions не предусмотрены и не требуются.

Proxy проверяет аутентификацию для защищённых URL. Кнопка выхода на `/app` вызывает Server Action `logout()`, которая завершает локальную Supabase-сессию и перенаправляет на login. Серверные страницы и профиль также выполняют серверную проверку; наличие старого React/RSC (React Server Components) дерева само по себе не является доказательством действующей сессии.

После logout/login в другой вкладке старая вкладка могла отправить Server Action POST на `/app` уже с отсутствующей или изменённой общей сессией. Ожидаемая серверная защита должна отказать в доступе, но не ломать транспортный протокол Server Action.

## Симптомы

В проблемном запросе подтверждено:

- `POST /app`
- HTTP `303 See Other`
- `Location: /login`
- `Cache-Control: private, no-store`
- request `Accept: text/x-component`
- присутствовал request header `Next-Action`
- response header `x-action-redirect` отсутствовал
- после redirect следовал `GET /login` со статусом `200`
- Next.js показывал `An unexpected response was received from the server`
- stack указывал на `<LogoutButton />` в `src/app/(protected)/app/page.tsx`

В логах отдельно наблюдался успешный `POST /app 200` с вызовом `logout()`. Это другой запрос, не тот проблемный `POST /app 303`. Stack frame у LogoutButton не доказывал, что сам компонент вызвал дефект.

Поведение проявлялось в нескольких вкладках одного профиля Chrome после смены общей сессии. Пользователь позднее подтвердил повторную ручную проверку: переключение аккаунтов между вкладками прошло успешно, Runtime Error больше не возникает.

## Шаги воспроизведения

Подтверждённые условия:

1. Открыть приложение в нескольких вкладках одного профиля браузера.
2. Авторизовать пользователя в защищённом приложении.
3. Завершить сессию либо сменить аккаунт в другой вкладке.
4. Из оставшейся вкладки вызвать Server Action на `/app` при изменившихся общих cookies.
5. Наблюдать `POST /app` с `Next-Action`, который Proxy завершает обычным `303` на `/login`; клиент показывает Runtime Error.

Дополнительные детали точной последовательности для конкретного срабатывания не предоставлены.

## Root Cause (первопричина)

### Подтверждённые факты

1. Проблемный request содержал `Next-Action`; в response не было `x-action-redirect`.
2. До исправления Proxy одинаково обрабатывал неавторизованные запросы к защищённому URL. Для методов, отличных от GET/HEAD, он возвращал обычный `NextResponse.redirect(..., 303)`.
3. Proxy выполняется до обработки route/Server Action. Значит, эта ветка могла завершить запрос до исполнения `logout()`.
4. В исходнике Next.js 16.4.3 Server Action client reducer принимает ответ как RSC при `Content-Type: text/x-component` либо как redirect при наличии `x-action-redirect`. Если нет ни RSC content type, ни action redirect, reducer формирует именно `An unexpected response was received from the server`.
5. Обычный HTTP `Location` redirect от Proxy не становится Server Action redirect только потому, что статус равен 303.

### Первопричина

Proxy применял правильную security-проверку, но не различал транспортный тип запроса. Он трактовал Server Action POST как обычный POST и возвращал redirect, который не соответствовал action response protocol Next.js. Это несовместимость на границе Proxy → App Router, а не доказанный дефект LogoutButton.

## Архитектурный / функциональный недостаток

В одном Proxy-решении были смешаны два разных решения:

- **доступ к маршруту:** анонимный обычный запрос к защищённому URL должен быть закрыт;
- **формат ответа:** Server Action запрос должен быть обработан Next.js action handler, чтобы redirect сериализовался в ожидаемом формате.

Proxy принудительно отдавал HTTP redirect ещё до action handler. Это не учитывало, что Server Actions вызываются POST-запросом к URL страницы и имеют отдельный формат ответа.

## Последствия

- **Функциональность:** Server Action могла не исполниться; logout на этой попытке не завершался.
- **UX:** Next.js показывал необработанную Runtime Error вместо корректного перехода к login.
- **Безопасность:** подтверждённого обхода авторизации или утечки профиля не установлено. Обычные защищённые запросы по-прежнему проверяются сервером.
- **Надёжность:** stale RSC-вкладка могла получать протокольно несовместимый ответ после изменения общих cookies.
- **Будущее развитие:** новые Server Actions на защищённых URL требуют собственной проверки доступа; Proxy не может быть единственной линией защиты действий.

## Исправление

### До исправления

До исправления не было отдельной ветки для action POST; анонимный POST попадал в общую ветку проверки `getUser()` и redirect:

```ts
// apps/web/src/proxy.ts (исходный фрагмент, зафиксирован до изменения)
if (error || !data.user) {
  const target = new URL('/login', request.url);
  const denied = NextResponse.redirect(
    target,
    ['GET', 'HEAD'].includes(request.method) ? 307 : 303,
  );
  response.cookies.getAll().forEach((cookie) => denied.cookies.set(cookie));
  denied.headers.set('Cache-Control', 'private, no-store');
  return denied;
}
```

Исходные файлы Authentication были untracked в рабочей копии, поэтому Git не предоставлял обычный tracked diff для этого исходного состояния. Фрагмент выше взят из чтения файла до исправления, а не реконструирован по догадке.

### После исправления

```ts
// apps/web/src/proxy.ts
if (
  pathname === routes.app &&
  request.method === 'POST' &&
  request.headers.has('Next-Action')
) {
  // Let Next.js produce the Flight/action redirect response. The logout
  // action verifies the current Auth session before completing sign-out.
  const actionResponse = NextResponse.next({ request });
  actionResponse.headers.set('Cache-Control', 'private, no-store');
  return actionResponse;
}
```

Server Action отдельно обращается к Supabase Auth, не доверяя старому клиентскому RSC-дереву:

```ts
// apps/web/src/features/application/actions/logout.ts
const client = await createClient();
const verified = await client.auth.getUser();
if (
  verified.error &&
  (verified.error.status === 0 || (verified.error.status ?? 0) >= 500)
) {
  return { error: 'Unable to sign out. Please try again.' };
}
const result = await client.auth.signOut({ scope: 'local' });
if (result.error) return { error: 'Unable to sign out. Please try again.' };
redirect('/login?logout=success');
```

### Объяснение

- Исключение ограничено точным маршрутом `/app`, методом POST и наличием `Next-Action`. Proxy не пропускает по этому правилу обычный GET, обычный POST или action-подобный запрос к неизвестному URL.
- `NextResponse.next()` передаёт Server Action Next.js, который сам оформляет результат/redirect. Код приложения не синтезирует `x-action-redirect`.
- `Next-Action` — маркер вида запроса, **не credential и не механизм авторизации**. Его можно подделать; action ID также нельзя считать разрешением на выполнение.
- Logout получает актуальный server-side результат `getUser()` и при ошибке Auth недоступности не объявляет выход успешным. Если сессия уже отсутствует, `signOut({ scope: 'local' })` может очистить локальное состояние, после чего action использует фиксированный redirect.
- Текущая logout-операция не читает и не изменяет данные продукта. Все будущие защищённые Server Actions обязаны проверять аутентификацию/авторизацию внутри действия.
- Proxy-ветка не является whitelist отдельных action IDs: Next.js сам разрешает переданный action ID. В текущем коде кроме logout есть recovery action; она требует recovery proof и выполняет `verifyOtp(type: 'recovery')` перед `updateUser`. Это не даёт обычному `Next-Action` заголовку полномочий, но новые actions нельзя добавлять без собственной проверки доступа.
- Ветка default-deny для обычных маршрутов и POST-запросов остаётся неизменной; API NestJS и его независимый JWT AuthGuard не менялись.

### Схема до исправления

```text
Browser (Server Action POST, Next-Action)
        │
        ▼
Proxy: getUser() не подтверждает сессию
        │
        └── обычный 303 + Location: /login
                    │
                    ▼
            Next Action reducer не получает RSC
            и не видит x-action-redirect
                    │
                    ▼
            Runtime Error в клиенте
```

### Схема после исправления

```text
Browser (POST /app, Next-Action)
        │
        ▼
Proxy: узкое исключение только для action POST /app
        │
        ▼
Next.js Server Action handler
        │
        ▼
logout(): Supabase getUser() → signOut(local)
        │
        ▼
Next.js формирует action-compatible redirect / Flight response
```

Для обычного анонимного RSC/GET `/app` и POST без `Next-Action` путь остаётся:

```text
Browser → Proxy → getUser() → 307/303 на /login
```

### Почему не открывать все POST

Все POST к `/app` без различения были бы шире необходимого исключения и могли бы направить обычные запросы в protected route. Более того, отсутствие UI-кнопки не делает Server Action приватным: action доступен как серверная точка вызова. Поэтому каждое действие должно выполнять собственную серверную проверку, а Proxy-исключение ограничено конкретным URL и типом протокола.

## Альтернативные решения

- **Вернуть `x-action-redirect` вручную из Proxy:** отклонено. Это внутренний протоколный заголовок; приложение не должно подделывать ответ Next.js action handler. Исправление передаёт action Next.js для штатного формирования ответа.
- **Пропустить все POST или все запросы с `Next-Action`:** отклонено. Это ненужно расширило бы исключения для маршрутов и ослабило бы default-deny.
- **Использовать Next-Action как доказательство авторизации:** отклонено. Это только признак типа запроса и не аутентифицирует пользователя.
- **Вводить per-tab sessions, задержки или глобальное клиентское хранилище:** не требуется для исправления протокольной ошибки и противоречит выбранной общей cookie-модели.

## Проверки

- **Автоматические тесты:** по отчёту Implementer запущены 5 targeted test files, **59 tests PASS**.
- **Proxy regression tests:** Server Action POST к `/app` проходит к Next handler; обычный анонимный POST к `/app` и action-запрос к неизвестному маршруту по-прежнему блокируются.
- **Logout regression tests:** проверены Auth lookup, отсутствие сессии, недоступность Auth и отказ signOut.
- **TypeScript:** PASS.
- **ESLint:** PASS.
- **Prettier:** PASS.
- **Реальная браузерная приёмка:** пользователь подтвердил PASS для переключения аккаунтов между вкладками; Runtime Error больше не возникает.
- **Границы evidence:** это пользовательский результат ручной приёмки. После исправления не записывались новые Network headers, и unit tests не считаются доказательством браузерного action response.
- **Остаточный риск:** исключение распознаёт внутренний request header `Next-Action`, проверенный для Next.js 16.4.3. При обновлении Next.js требуется подтвердить, что marker и Server Action handling сохраняют ожидаемую семантику.

## Lessons Learned

1. Proxy redirect и redirect из Server Action — не взаимозаменяемы, даже если в конкретном случае оба используют HTTP 303.
2. При диагностике App Router нужно сохранить request/response headers action запроса и различать каждый POST отдельно.
3. Stack frame у кнопки/формы может показывать место вызова действия, а не источник некорректного HTTP-ответа.
4. Proxy может закрывать страницы, но Server Actions следует рассматривать как публично вызываемые серверные entry points и проверять внутри action.
5. Исключения для внутренних протоколов нужно ограничивать маршрутом/методом, документировать и повторно проверять при обновлении framework.
6. Общие cookies означают общую сессию между вкладками; не следует обещать изоляцию аккаунтов по вкладкам.

## References

### Официальная документация

- [Next.js Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy) — Proxy выполняется до маршрута; Server Functions обрабатываются как POST на URL, где они используются; проверки доступа необходимы внутри каждой функции.
- [Next.js `redirect`](https://nextjs.org/docs/app/api-reference/functions/redirect) — `redirect()` в Server Action инициирует client-side navigation при доступном JavaScript; для progressive-enhancement формы используется 303.
- [Next.js Data Security](https://nextjs.org/docs/app/guides/data-security) — Server Actions доступны через POST и должны самостоятельно проверять аутентификацию/авторизацию.
- [Next.js Mutating Data](https://nextjs.org/docs/app/getting-started/mutating-data) — Server Actions являются серверными функциями, вызываются POST, а redirect после mutation оформляется в action.

### Источники, непосредственно подтверждающие протокол

- [Next.js 16.4.3 `server-action-reducer.ts`](https://github.com/vercel/next.js/blob/v16.4.3/packages/next/src/client/components/router-reducer/reducers/server-action-reducer.ts) — проверено условие: допустим RSC response с `text/x-component` либо redirect response с `x-action-redirect`; в противном случае создаётся сообщение `An unexpected response was received from the server`.
- [Next.js 16.4.3 `action-handler.ts`](https://github.com/vercel/next.js/blob/v16.4.3/packages/next/src/server/app-render/action-handler.ts) — проверено, что redirect из fetch Server Action оформляется самим Next.js action handler; MPA form action имеет отдельную обработку 303.

Эти исходники подтверждают несовместимость ответа с протоколом Next.js указанной версии. Они не являются отчётом о конкретной пользовательской ошибке; её связь подтверждена отдельно предоставленными Network headers и Proxy кодом.

### Связанные материалы проекта

- [`apps/web/src/proxy.ts`](../../../apps/web/src/proxy.ts) — default-deny Proxy и исключение для action POST `/app`.
- [`apps/web/src/config/access-policy.ts`](../../../apps/web/src/config/access-policy.ts) — allowlist public auth routes и framework asset exceptions.
- [`apps/web/src/features/application/actions/logout.ts`](../../../apps/web/src/features/application/actions/logout.ts) — проверка Supabase Auth и logout.
- [`apps/web/src/features/application/ui/logout-button.tsx`](../../../apps/web/src/features/application/ui/logout-button.tsx) — клиентский вызов Server Action через `useActionState`.
- [`apps/web/src/proxy.test.ts`](../../../apps/web/src/proxy.test.ts) — регрессии Proxy для action POST и default-deny.
- [`apps/web/src/features/application/actions/logout.test.ts`](../../../apps/web/src/features/application/actions/logout.test.ts) — регрессии logout.

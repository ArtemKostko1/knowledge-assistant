# AUTH-002 — Next.js Development Logging: раскрытие recovery token_hash в журналах HTTP-запросов

## Метаданные

- **ID:** AUTH-002
- **Название:** Next.js Development Logging: раскрытие recovery token_hash в журналах HTTP-запросов
- **Обнаружена:** точная дата неизвестна
- **Документирована:** 2026-11-17
- **Компонент / подсистема:** Authentication / Next.js development request logging
- **Стек и версии:** Next.js 16.4.6, Supabase Auth, App Router, Server Actions
- **Severity:** Medium — секрет восстановления пароля попадал в локальный вывод dev-сервера; установленный масштаб ограничен development-окружением
- **Status:** Verified — подтверждено только исправление журналирования входящих запросов в Next.js development
- **Связанные файлы:** [`apps/web/next.config.ts`](../../../apps/web/next.config.ts), [`apps/web/src/app/auth/recovery/page.tsx`](../../../apps/web/src/app/auth/recovery/page.tsx), [`apps/web/src/features/auth/ui/RecoveryForm/RecoveryForm.tsx`](../../../apps/web/src/features/auth/ui/RecoveryForm/RecoveryForm.tsx), [`apps/web/src/features/auth/actions/update-password.ts`](../../../apps/web/src/features/auth/actions/update-password.ts), [`apps/web/src/lib/supabase/recovery.ts`](../../../apps/web/src/lib/supabase/recovery.ts), [`apps/web/src/proxy.ts`](../../../apps/web/src/proxy.ts)

## Контекст

Приложение использует ссылку восстановления Supabase Auth, которая открывает маршрут App Router (маршрутизация Next.js на основе файловой структуры) `/auth/recovery` с одноразовым `token_hash` в query string (строке параметров URL). Страница валидирует формат токена и передаёт его в `RecoveryForm`; форма отправляет значение через Server Action (серверное действие Next.js) для проверки через `verifyOtp` и обновления пароля.

Пока работал Next.js development server, его журнал входящих запросов включал полный URL запроса восстановления. Значит, при таком запросе локальный stdout (стандартный поток вывода) содержал URL с query string, в котором находился recovery proof (одноразовый секрет подтверждения восстановления). Подтверждённое место раскрытия — именно локальный development stdout; production logging этим инцидентом не установлен.

## Симптомы

- Запрос `GET /auth/recovery` с query-параметром `token_hash` отражался в выводе Next.js dev server как полный request URL.
- При просмотре диагностики использовалось только синтетическое обозначение секретного значения; реальные токены в этом разборе не приводятся.
- Затронутый сценарий воспроизводился в Next.js development. Данных о раскрытии через production access logs или иные системы журналирования нет.

## Шаги воспроизведения

1. Запустить приложение в Next.js development-режиме.
2. Открыть `/auth/recovery` с синтетическим тестовым значением `token_hash` в query string.
3. Убедиться, что development stdout показывает полный URL запроса; не копировать и не сохранять действительный recovery proof.

## Root Cause (первопричина)

### Подтверждённые факты

- До исправления конфигурация приложения не задавала `logging.incomingRequests`. По предоставленной диагностике прежний `apps/web/next.config.ts` задавал `output: 'standalone'`, `outputFileTracingRoot` и `allowedDevOrigins`, но не logging-настройки. Точный исходный фрагмент конфигурации до изменения в доступных материалах не сохранён, поэтому он не реконструируется ниже.
- В Next.js 16.4.6 входящие запросы в development журналируются по умолчанию. Официальная документация описывает настройку `logging.incomingRequests.ignore`.
- Официальный исходник dev request logger (журналировщика входящих запросов) в Next.js 16.4.6 проверяет ignore-pattern через `pattern.test(request.url)` и журналирует URL запроса. Следовательно, URL с query string и секретом попадал в локальную строку журнала.
- В приложении `token_hash` поступает на recovery page как query-параметр, передаётся в hidden input формы и далее в Server Action. Код recovery flow использует его для `verifyOtp({ type: 'recovery' })`.
- Подтверждённая причина — применение стандартного development request logging к route с одноразовым секретом в URL. Нет свидетельств, что токен был раскрыт в production или использован посторонним лицом.

### Не подтверждено

- Документация Next.js описывает отдельное журналирование вызовов Server Functions (серверных функций) с аргументами. Однако конкретный инцидент подтверждает полный URL в логе входящего GET-запроса, а не вывод значения `token_hash` в журнале аргументов Server Action. Возможное появление чувствительных данных в иных каналах журналирования требует отдельной проверки и не считается установленной причиной AUTH-002.

## Архитектурный / функциональный недостаток

Recovery proof передаётся в query string, а development request logger по умолчанию записывает входящие URL. При этом приложение не исключало маршрут с секретом в URL из такого логирования. Заголовки ответа для recovery flow, включая `Referrer-Policy: no-referrer` и `Cache-Control: private, no-store`, не предотвращают запись входящего URL в серверный stdout: это отдельный канал журналирования.

## Последствия

- **Функциональность:** обработка восстановления пароля не была нарушена; проблема касалась только журнальной записи URL.
- **UX:** обычные пользователи не видели изменений интерфейса. Для разработчика запросы `/auth/recovery` больше не отображаются в журнале входящих запросов Next.js development logger.
- **Безопасность:** recovery proof является одноразовым секретом. Если локальный stdout доступен постороннему лицу, значение могло бы позволить попытку использования в пределах срока действия и до использования/отзыва. Подтверждено только присутствие полного URL в локальном development stdout; утечка за пределы этой среды, успешное использование токена и production-воздействие не установлены.
- **Надёжность:** исправление не меняет проверку токена, обновление пароля или отказ для некорректного/просроченного proof. Общий журнал для других путей остаётся включённым.
- **Будущее развитие:** фильтр привязан к пути recovery route; при переименовании маршрута или смене формата URL нужно пересмотреть правило и повторить ручную проверку. Request logging и журналирование Server Function arguments — отдельные механизмы и должны проверяться раздельно.

## Исправление

### До исправления

Точная исходная версия `apps/web/next.config.ts` не сохранена в доступных материалах. По подтверждённому контексту, конфигурация содержала `output: 'standalone'`, `outputFileTracingRoot` и `allowedDevOrigins`, но не содержала `logging`. Исходный фрагмент кода не реконструируется.

### После исправления

Текущий фрагмент `apps/web/next.config.ts`:

```ts
logging: {
  incomingRequests: {
    ignore: [/\/auth\/recovery(?:\?.*)?$/],
  },
},
```

### Объяснение

Регулярное выражение исключает из development-журнала входящих запросов URL, оканчивающийся на `/auth/recovery`, как без query string, так и с query string. Согласно исходнику Next.js 16.4.6, ignore-pattern проверяется против `request.url`; правило поэтому охватывает URL с recovery query-параметром. Оно ограничено маршрутом восстановления и не совпадает с `/login`, который продолжает журналироваться.

Настройка не отключает журналы всех входящих запросов и не меняет сам recovery flow, передачу proof в Server Action или его проверку Supabase Auth. Она исправляет только подтверждённый канал — Next.js development request logger. Она не является доказательством отсутствия токена в других системах журналирования.

## Альтернативные решения

- Отключить журналирование всех входящих запросов: не выбрано, поскольку это убрало бы полезный development logging для остальных маршрутов.
- Удалить секрет из URL и изменить способ передачи recovery proof: это потребовало бы изменения auth-flow вне минимального scope данного исправления.
- Глобально отключить все Next.js development logging: не выбрано, поскольку проблема подтверждена для одного конкретного route и одного logger.

## Проверки

- **Автоматические тесты:** для данного logging fix не запускались.
- **Статические проверки:** по предоставленным результатам TypeScript — PASS; Prettier — PASS. В рамках документационной задачи эти команды повторно не запускались.
- **Ручная приёмка:** подтверждены все четыре сценария: recovery GET исключён из dev request log — PASS; обычный `GET /login` по-прежнему журналируется — PASS; recovery POST/Server Action — PASS; обработка некорректного recovery proof — PASS.
- **Ограничения:** build и тесты не запускались. Производственные access logs, reverse proxy, Docker/hosting logs и внешняя telemetry не проверялись. Status **Verified** относится только к подтверждённому исправлению development request logging.
- **Остаточные риски:** отдельно не проверены production access logs, reverse proxy (обратный proxy)/Docker/hosting logs, внешняя telemetry и browser history (история браузера). `Referrer-Policy: no-referrer` не удаляет URL из browser history. Журналирование аргументов Server Action — отдельный потенциальный канал; наличие в нём recovery proof в рамках этого инцидента не подтверждено.

## Lessons Learned

- Не включать одноразовые секреты в URL, если это возможно в рамках протокола; если это неизбежно, исключать маршруты с такими секретами из соответствующих request logs.
- Проверять поведение каждого logging channel отдельно: incoming request URL logging не равен Server Function argument logging, proxy logging или production access logging.
- Для route-specific ignore rules проверять и целевой чувствительный маршрут, и обычный маршрут, который должен продолжать журналироваться.
- Не считать `no-store` и `no-referrer` защитой от серверного журналирования URL или сохранения URL в browser history.

## References

### Официальная документация

- [Next.js `logging` configuration](https://nextjs.org/docs/app/api-reference/config/next-config-js/logging) — описывает включённое по умолчанию журналирование входящих запросов в development, `incomingRequests.ignore`, отсутствие влияния этой настройки на production builds и отдельное журналирование Server Functions с аргументами.

### Источники, непосредственно подтверждающие инцидент

- [Next.js v16.4.6 `log-requests.ts`](https://github.com/vercel/next.js/blob/v16.4.6/packages/next/src/server/dev/log-requests.ts) — pinned source dev request logger; проверяет ignore-pattern относительно `request.url` и выводит request URL. Источник подтверждает механизм framework; наблюдение полного URL в stdout приложения основано на предоставленной диагностике инцидента.
- [Next.js v16.4.6 `server-action-logger.ts`](https://github.com/vercel/next.js/blob/v16.4.6/packages/next/src/server/dev/server-action-logger.ts) — отдельный источник для механизма Server Action logging; не является доказательством, что значение recovery proof было выведено в этом инциденте.

### Связанные материалы проекта

- [`apps/web/next.config.ts`](../../../apps/web/next.config.ts) — точечный ignore-pattern для development incoming-request logging.
- [`apps/web/src/app/auth/recovery/page.tsx`](../../../apps/web/src/app/auth/recovery/page.tsx) — recovery route, динамическая страница и проверка формы токена.
- [`apps/web/src/features/auth/ui/RecoveryForm/RecoveryForm.tsx`](../../../apps/web/src/features/auth/ui/RecoveryForm/RecoveryForm.tsx) — передача токена в hidden input для Server Action.
- [`apps/web/src/features/auth/actions/update-password.ts`](../../../apps/web/src/features/auth/actions/update-password.ts) — передача полей формы в `recoverPassword`.
- [`apps/web/src/lib/supabase/recovery.ts`](../../../apps/web/src/lib/supabase/recovery.ts) — проверка токена через Supabase Auth и обновление пароля.
- [`apps/web/src/proxy.ts`](../../../apps/web/src/proxy.ts) — response headers и обработка token flow; эти заголовки не заменяют фильтрацию серверных логов.

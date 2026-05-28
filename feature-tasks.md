# Drop4 — feature backlog

Фичи, которые мы решили сделать, но не сразу. Берём по одной в следующих сессиях и переносим в **Done** когда раскатываем.

## Open

_(нет открытых задач — все запланированное доставлено)_

## Done

- [x] **Анимации на лендинге** — три добавления, всё на чистом CSS + один Web Worker-style client island. (1) `HeroBoardAutoplay` — статичный `BOARD_HERO` снэпшот заменён на саморазыгрывающуюся 11-ходовую партию, заканчивается коралловой диагональю, держит win line 2.2с, циклится. Использует существующий `drop4-drop` keyframe в Board.tsx, паузится на `document.visibilitychange`, уважает `prefers-reduced-motion` (показывает финальную позицию замороженной). (2) Hero copy stagger — `drop4-fade-up` с задержками 0/80/160/240/320 мс на пять детей `.heroCopy`. (3) Feature-card scroll cascade — `FeatureGrid` client island с IntersectionObserver добавляет `.cascadeIn` класс на первом входе во вьюпорт, карточки выезжают с 0/120/240 мс. Глобальный `prefers-reduced-motion` killswitch покрывает всё.

- [x] **Фоновая музыка** — HoliznaCC0 "One Night In France" (CC0, 3:14, lofi piano) в `public/audio/lofi.mp3`, 128 kbps ~3MB. Singleton `musicPlayer` с fade in (1.4s) / fade out (0.7s), default volume 0.10. Default ON через muted-autoplay трюк: audio создаётся с `muted=true`, `play()` стартует (браузер разрешает muted-autoplay), при первом любом жесте пользователя (`pointerdown/touchstart/keydown/wheel/scroll`) mute снимается с fade-in. Иконка через subscribe-API отражает реальное `isPlaying()`. Mute-преференция в localStorage `drop4-music` побеждает дефолт.

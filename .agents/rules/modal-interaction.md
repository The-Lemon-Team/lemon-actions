# Правило работы с модальными окнами (Modal Dialogs: Close & Outside Click)

Все модальные окна в проекте Lemon Actions (включая разделы Core Dashboard, Lemon Code Lab, Lemon Home Tracker, Neuron Arena) должны строго следовать единому стандарту закрытия и обработки клика вне окна (outside click).

---

## 1. Поведение при клике вне окна (Backdrop / Outside Click)
* **Закрытие по клику на фон**: Клик по подложке (overlay/backdrop) за пределами контента модального окна обязан инициировать закрытие модалки.
* **Защита от случайного закрытия при выделении текста (Mousedown Check)**:
  * Если пользователь нажал кнопку мыши (`mousedown`) внутри карточки модального окна (например, выделял текст в инпуте, перемещал курсор) и отпустил (`mouseup`/`click`) за пределами окна на затемненном фоне — модальное окно **НЕ ДОЛЖНО** закрываться.
  * Для этого проверяется, что и `mousedown`, и `click` произошли непосредственно на элементе подложки (`event.target === backdropElement && mouseDownTarget === backdropElement`).
* **Игнорирование кликов по скроллбару**: Клик или перемещение ползунка полосы прокрутки фона (`event.clientX >= host.clientWidth || event.clientY >= host.clientHeight`) не должен закрывать модалку.

---

## 2. Закрытие с клавиатуры (Клавиша Escape)
* При открытом модальном окне нажатие клавиши `Escape` (`document:keydown.escape`) должно закрывать активную модалку.
* Событие `Escape` должно перехватываться (`event.stopPropagation()`), чтобы не вызывать нежелательных побочных эффектов в родительских слоях.

---

## 3. Явные элементы управления закрытием
* **Кнопка-крестик в заголовке**: Каждое модальное окно должно содержать кнопку закрытия с иконкой `close` (`material-symbols-rounded`) и понятным `aria-label` («Закрыть» / `'createModal.closeAria' | trans`).
* **Кнопка отмены в футере**: Обязательно наличие кнопки «Отмена» / «Закрыть» для пользователей, предпочитающих текстовые кнопки.

---

## 4. Очистка и сброс состояния при закрытии (State Cleanup)
* При закрытии модального окна без сохранения (по крестику, клавише Escape, клику outside или кнопке Отмена) временные несохраненные данные (черновики инпутов, временные флаги, ошибки валидации) должны быть сброшены, чтобы при следующем открытии форма находилась в исходном чистом состоянии.
* Если идет активная отправка данных (`isSubmitting === true`), закрытие по клику outside и по Escape временно блокируется (`[appModalOverlayDismissable]="!isSubmitting"`), предотвращая разрыв асинхронных операций.

---

## 5. Доступность (A11y)
* Контейнер подложки должен иметь атрибуты:
  * `role="dialog"`
  * `aria-modal="true"`
  * `aria-labelledby="<id-заголовка>"`
* Внутренний контейнер карточки должен останавливать всплытие кликов `(click)="$event.stopPropagation()"` или опираться на проверку цели в директиве.

---

## 6. Использование единой директивы `ModalOverlayDirective`
Для применения этих правил в шаблонах Angular-компонентов используется общая директива:
`import { ModalOverlayDirective } from '../../core/directives/modal-overlay.directive';`

```html
<div
  appModalOverlay
  [appModalOverlayDismissable]="!isSubmitting"
  (overlayClose)="onCancelOrClose()"
  class="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
  aria-labelledby="modal-title-id"
>
  <div (click)="$event.stopPropagation()" class="bg-surface-container-lowest rounded-2xl ...">
    <!-- Header with title & close button -->
    <!-- Body -->
    <!-- Footer with Cancel button -->
  </div>
</div>
```

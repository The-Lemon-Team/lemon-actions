# Agent Rule: Angular & SOLID Clean Architecture Standard

## Purpose
This standard ensures that all Angular code produced in this repository adheres to modern best practices (Angular 18/19+), strict SOLID principles, optimal change detection performance, and clean separation of concerns.

---

## 1. Modern Angular Paradigms (Angular 18/19 Standards)

1. **Standalone Architecture**:
   - All components, directives, and pipes MUST be `standalone: true`.
   - Never generate legacy `NgModule` bundles.
2. **Modern Control Flow**:
   - Always use native control flow: `@if (...)`, `@for (...; track item.id)`, `@switch (...)`, `@empty`.
   - Do NOT use legacy `*ngIf`, `*ngFor`, or `*ngSwitch`.
3. **Functional Dependency Injection**:
   - Inject dependencies using `inject(Service)` instead of constructor injection.
4. **Change Detection Strategy**:
   - All components MUST specify `changeDetection: ChangeDetectionStrategy.OnPush`.
   - State mutations MUST trigger changes via reactive streams (`BehaviorSubject`, `Observable`) or Angular `signals` (`signal()`, `computed()`).
5. **Safe Template Bindings**:
   - Never use forward slash `/` in attribute class bindings (e.g. `[class.bg-black/5]="..."` is parsed by Angular as a math division operator and throws syntax errors).
   - Use `[class]="condition ? 'bg-black/5' : '...'"` or helper methods.

---

## 2. SOLID Architectural Principles in Angular

### S — Single Responsibility Principle (SRP)
* **Smart / Dumb Component Separation**:
  * **Presentational (Dumb) Components**: Pure views. Accept inputs, emit outputs via `EventEmitter` / `output()`. Contain zero HTTP calls and zero global store mutations.
  * **Container (Smart) Components**: Mediate between domain services and presentation components.
* **Focused Domain Services**: A service owns exactly one responsibility (e.g. `ProjectStandService` manages stand models; `PortShieldEngine` allocates ports; `ApiService` handles HTTP transport).

### O — Open/Closed Principle (OCP)
* Components and services are open for extension but closed for modification.
* Extend component behavior using:
  * **Directives** (e.g. `ModalOverlayDirective` for backdrop handling).
  * **Content Projection** (`<ng-content>`) with multiple template slots.
  * **Injection Tokens** (`InjectionToken<T>`) for pluggable behaviors and strategies.

### L — Liskov Substitution Principle (LSP)
* Define contracts and interfaces first (`packages/.../types`).
* Ensure implementations can be swapped without breaking consumers (e.g. mock services during tests, local storage vs. REST API persistence).

### I — Interface Segregation Principle (ISP)
* Keep interfaces lean and domain-focused.
* Never force a presentational component to depend on a monolithic model if it only renders a status chip or badge.
* Decompose rich objects into focused sub-interfaces (`StandAppItem`, `ProjectSessionLogEntry`, `ReactiveTodoItem`).

### D — Dependency Inversion Principle (DIP)
* High-level components depend on abstractions, not concrete low-level implementations.
* Use Angular DI tokens and abstract services.
* Decouple cross-component coordination via reactive event buses (`FlowOrchestratorService`, `healthEvent$`, `workerTriggered$`) instead of tightly coupled parent-child method chains.

---

## 3. Modal Dialogs & Interaction Standard Compliance
* Any modal dialog component MUST strictly conform to [`.agents/rules/modal-interaction.md`](./modal-interaction.md):
  * `appModalOverlay` directive with backdrop `mousedown` origin tracking.
  * Escape key dismissal.
  * Clean form and transient state reset on dismiss.
  * Accessibility attributes (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`).

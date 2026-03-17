# AQELOR — Guía de Colores

Este documento define la paleta principal de AQELOR y el uso recomendado de cada color en la aplicación de escritorio y en la página web.

## Paleta principal

### 1. Obsidian
- **Hex:** `#0B0F14`
- **Uso:** fondo principal en modo oscuro, layout base, zonas de máxima profundidad visual.

### 2. Graphite
- **Hex:** `#171C23`
- **Uso:** tarjetas, paneles, sidebar, superficies secundarias en modo oscuro.

### 3. Slate
- **Hex:** `#2A3342`
- **Uso:** bordes, divisores, fondos secundarios, estados neutros, líneas de separación.

### 4. Frost
- **Hex:** `#F5F7FB`
- **Uso:** fondo principal en modo claro, fondos suaves, secciones amplias en web.

### 5. Ink
- **Hex:** `#111827`
- **Uso:** texto principal en modo claro, iconos oscuros, logo sobre fondo claro.

### 6. Electric Blue
- **Hex:** `#3B82F6`
- **Uso:** color principal de marca, botones primarios, navegación activa, enlaces, highlights principales.

### 7. Signal Cyan
- **Hex:** `#22D3EE`
- **Uso:** acento secundario, indicadores de actividad, agentes activos, estados “live”, elementos de IA en ejecución.

## Colores de soporte

### 8. Success Mint
- **Hex:** `#22C55E`
- **Uso:** validaciones exitosas, checks, éxito, misiones completadas.

### 9. Warning Amber
- **Hex:** `#F59E0B`
- **Uso:** advertencias, riesgo moderado, revisiones pendientes.

### 10. Danger Coral
- **Hex:** `#EF4444`
- **Uso:** errores, bloqueos, riesgo alto, acciones destructivas.

### 11. Violet Pulse
- **Hex:** `#8B5CF6`
- **Uso:** funciones avanzadas, research, IA profunda, módulos experimentales.

## Uso por componente

## Fondos

### Modo oscuro
- **App background:** `#0B0F14`
- **Secondary background:** `#111827`
- **Surface:** `#171C23`
- **Elevated surface:** `#1E2632`

### Modo claro
- **App background:** `#F5F7FB`
- **Secondary background:** `#EEF2F8`
- **Surface:** `#FFFFFF`
- **Elevated surface:** `#FCFDFE`

## Texto

### Modo oscuro
- **Texto principal:** `#F5F7FB`
- **Texto secundario:** `#A8B3C4`
- **Texto muted:** `#7C8798`

### Modo claro
- **Texto principal:** `#111827`
- **Texto secundario:** `#475569`
- **Texto muted:** `#64748B`

## Bordes y separadores

### Modo oscuro
- **Border subtle:** `#263042`
- **Border strong:** `#344054`

### Modo claro
- **Border subtle:** `#D7DFEA`
- **Border strong:** `#C4D0E0`

## Botones

### Botón primario
- **Background:** `#3B82F6`
- **Texto:** `#FFFFFF`
- **Hover:** `#2563EB`
- **Uso:** CTA principal, guardar, iniciar misión, conectar repositorio.

### Botón secundario
- **Modo oscuro:** fondo `#171C23`, borde `#344054`, texto `#F5F7FB`
- **Modo claro:** fondo `#FFFFFF`, borde `#C4D0E0`, texto `#111827`
- **Uso:** acciones secundarias, cancelar, volver, ver detalles.

### Botón crítico
- **Background:** `#EF4444`
- **Texto:** `#FFFFFF`
- **Hover:** `#DC2626`
- **Uso:** eliminar, desactivar, forzar detención, revocar acceso.

## Estados del sistema

- **Analizando:** `#3B82F6`
- **En ejecución:** `#22D3EE`
- **Validando:** `#3B82F6`
- **Aprobado / completado:** `#22C55E`
- **Requiere revisión:** `#F59E0B`
- **Bloqueado / error:** `#EF4444`
- **Experimental / research:** `#8B5CF6`

## Navegación y UI

- **Item activo en navegación:** `#3B82F6`
- **Indicador live:** `#22D3EE`
- **Badges neutrales:** `#2A3342`
- **Badges de éxito:** `#22C55E`
- **Badges de warning:** `#F59E0B`
- **Badges de error:** `#EF4444`

## Logo y branding

### Versión principal
- **Logo sobre fondo claro:** `#111827`
- **Logo sobre fondo oscuro:** `#F5F7FB`

### Acento opcional
- **Color de acento recomendado:** `#3B82F6` o `#22D3EE`
- **Uso:** detalles muy pequeños, animaciones, glow sutil, highlights de marca.

## Componentes Específicos

### Calendario (Picker)
- **Fondo:** `#111827` (Ink) con borde `#263042` (Slate Subtle).
- **Sombra:** `shadow-2xl` con opacidad profunda.
- **Header:** Botón de año expandible, navegación de meses con iconos Lucide.
- **Estados de Días:**
  - **Hoy:** Highlight `#3B82F6` con opacidad 10%.
  - **Seleccionado:** Fondo `#3B82F6`, texto blanco, escala 110%, sombra de brillo azul.
  - **Hover:** Fondo `#263042` (Slate Subtle).
- **Animación:** Entrada con muelle (`spring`), escala de 0.95 a 1, desplazamiento suave en eje Y.

### Dropdown (Custom Select)
- **Fondo del Menú:** `#111827` (Ink).
- **Borde del Menú:** `#263042` (Slate Subtle).
- **Items:**
  - **Seleccionado:** Acento `#3B82F6` al 10% de opacidad, texto en azul brillante, icono de check.
  - **Hover:** Fondo `#171C23` (Graphite), texto `#F5F7FB` (Frost).
- **Transiciones:** `AnimatePresence` para entradas/salidas suaves con ligero desplazamiento vertical.

## Regla de uso recomendada

- **70%** neutros base
- **20%** superficies, contraste y estructura
- **10%** acentos de marca y estados

Esta distribución ayuda a que AQELOR se vea sobrio, técnico y premium, permitiendo que el azul y el cyan destaquen sin saturar la interfaz.


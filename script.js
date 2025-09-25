const TOOL_GROUPS = [
  {
    name: "Players",
    items: [
      {
        id: "player-blue",
        label: "Blue Player",
        type: "circle",
        radius: 4,
        color: "#60a5fa"
      },
      {
        id: "player-red",
        label: "Red Player",
        type: "triangle",
        size: 9,
        color: "#f87171"
      },
      {
        id: "player-neutral",
        label: "Yellow Player",
        type: "circle",
        radius: 4,
        color: "#facc15"
      },
      {
        id: "coach",
        label: "Coach",
        type: "pentagon",
        size: 7,
        color: "#111827",
        inscription: "Coach",
        textColor: "#f8fafc"
      },
      {
        id: "goalkeeper",
        label: "Goalkeeper",
        type: "pentagon",
        size: 6.5,
        color: "#111827",
        inscription: "GK",
        textColor: "#f8fafc"
      }
    ]
  },
  {
    name: "Equipment",
    items: [
      {
        id: "cone",
        label: "Cone",
        type: "triangle",
        size: 8,
        color: "#fb923c"
      },
      {
        id: "pole",
        label: "Pole",
        type: "rect",
        width: 1.4,
        height: 14,
        color: "#38bdf8"
      },
      {
        id: "mini-goal",
        label: "Mini Goal",
        type: "goal",
        width: 12,
        height: 8,
        stroke: "#e5e7eb"
      },
      {
        id: "ball",
        label: "Ball",
        type: "circle",
        radius: 2.4,
        color: "#f4f4f5",
        stroke: "#0f172a"
      }
    ]
  },
  {
    name: "Actions",
    items: [
      {
        id: "run",
        label: "Run",
        type: "arrow",
        width: 0.5,
        color: "#facc15",
        style: "simple"
      },
      {
        id: "pass",
        label: "Pass",
        type: "arrow",
        width: 0.5,
        color: "#38bdf8",
        style: "dashed"
      },
      {
        id: "two-way",
        label: "Two-Way",
        type: "arrow",
        width: 0.5,
        color: "#f97316",
        style: "double"
      }
    ]
  }
];

const SVG_NS = "http://www.w3.org/2000/svg";
const pitch = document.getElementById("pitch");
const menu = document.getElementById("menu");
const groupTemplate = document.getElementById("menu-group-template");
const itemTemplate = document.getElementById("menu-item-template");
const actionMenu = document.getElementById("action-menu");
const actionToggle = document.getElementById("action-toggle");
const actionToggleLabel = document.getElementById("action-toggle-label");
const actionDropdown = actionMenu ? actionMenu.querySelector('[data-role="action-dropdown"]') : null;
const actionButtons = Array.from(actionMenu.querySelectorAll("[data-action]"));
const sizeButtons = Array.from(actionMenu.querySelectorAll("[data-size-scale]"));
const colorButtons = Array.from(actionMenu.querySelectorAll("[data-color]"));
const resizePanel = actionMenu.querySelector('[data-panel="resize"]');
const colorPanel = actionMenu.querySelector('[data-panel="color"]');
const sizeScaleValues = sizeButtons.map((btn) => {
  const value = parseFloat(btn.dataset.sizeScale || "1");
  return Number.isFinite(value) && value > 0 ? value : 1;
});
const actionButtonLookup = actionButtons.reduce((map, btn) => {
  const action = btn.dataset.action;
  if (action) {
    map[action] = btn;
  }
  return map;
}, {});

let currentTool = null;
let activeButton = null;
let arrowDraft = null;
let currentAction = "move";
let activeActionButton = actionButtons.find((btn) => btn.dataset.action === currentAction) || null;
let selectedSizeScale = 1;
let activeSizeButton = sizeButtons.find((btn) => btn.dataset.sizeScale === "1") || null;
let selectedColor = "#f97316";
let activeColorButton = colorButtons.find((btn) => btn.dataset.color === selectedColor) || null;
let dragState = null;
let sizeCycleIndex = 0;
let autoCycleResize = true;
let actionMenuHoverTimer = null;
let isActionMenuOpen = false;
const ACTION_MENU_HOVER_DELAY = 1000;

if (!activeActionButton && actionButtons.length) {
  activeActionButton = actionButtons[0];
  currentAction = activeActionButton.dataset.action || currentAction;
}

if (!activeSizeButton && sizeButtons.length) {
  activeSizeButton = sizeButtons[0];
  selectedSizeScale = parseFloat(activeSizeButton.dataset.sizeScale || "1");
}

if (!activeColorButton && colorButtons.length) {
  activeColorButton = colorButtons[0];
  selectedColor = activeColorButton.dataset.color || selectedColor;
}

sizeCycleIndex = Math.max(sizeScaleValues.indexOf(selectedSizeScale), 0);

renderMenu();
setupPitchInteraction();
setupActions();

function renderMenu() {
  menu.innerHTML = "";
  TOOL_GROUPS.forEach((group) => {
    const fragment = groupTemplate.content.cloneNode(true);
    const groupRoot = fragment.querySelector(".menu-group");
    const title = fragment.querySelector(".menu-group__title");
    const itemsRoot = fragment.querySelector(".menu-group__items");

    title.textContent = group.name;

    group.items.forEach((tool) => {
      const itemFrag = itemTemplate.content.cloneNode(true);
      const button = itemFrag.querySelector(".menu-item");
      button.dataset.toolId = tool.id;
      button.addEventListener("click", () => setCurrentTool(tool, button));

      const preview = document.createElement("div");
      preview.className = "menu-item__preview";
      preview.append(renderPreview(tool));

      const label = document.createElement("span");
      label.className = "menu-item__label";
      label.textContent = tool.label;

      button.append(preview, label);
      itemsRoot.appendChild(itemFrag);
    });

    menu.appendChild(groupRoot);
  });
}

function setCurrentTool(tool, button) {
  if (activeButton === button) {
    button.setAttribute("aria-pressed", "false");
    currentTool = null;
    activeButton = null;
    return;
  }

  if (activeButton) {
    activeButton.setAttribute("aria-pressed", "false");
  }

  button.setAttribute("aria-pressed", "true");
  currentTool = tool;
  activeButton = button;

  const moveButton = actionButtonLookup.move || null;
  setCurrentAction("move", moveButton, { preserveTool: true });
}

function setupActions() {
  actionButtons.forEach((button) => {
    const actionId = button.dataset.action || "move";
    const isActive = button === activeActionButton;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.addEventListener("click", () => {
      cancelActionMenuHoverTimer();
      setCurrentAction(actionId, button);
      if (actionId === "resize" || actionId === "color") {
        openActionMenu();
      } else {
        closeActionMenu({ immediate: true });
      }
    });
  });

  sizeButtons.forEach((button) => {
    const scale = parseFloat(button.dataset.sizeScale || "1");
    const isActive = button === activeSizeButton;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      selectedSizeScale = scale;
    }
    button.addEventListener("click", () => {
      autoCycleResize = false;
      setSizeScale(scale, button);
    });
  });

  colorButtons.forEach((button) => {
    const color = button.dataset.color || "#ffffff";
    const isActive = button === activeColorButton;
    button.style.color = color;
    button.setAttribute("aria-pressed", isActive ? "true" : "false");
    button.classList.toggle("is-active", isActive);
    if (isActive) {
      selectedColor = color;
    }
    button.addEventListener("click", () => setSelectedColor(color, button));
  });

  updateActionPanels();
  updateActionToggleLabel();

  if (actionMenu) {
    actionMenu.addEventListener("pointerenter", handleActionMenuPointerEnter);
    actionMenu.addEventListener("pointerleave", handleActionMenuPointerLeave);
  }

  if (actionToggle) {
    actionToggle.addEventListener("click", handleActionToggleClick);
    actionToggle.addEventListener("keydown", handleActionToggleKeyDown);
  }
}

function handleActionMenuPointerEnter() {
  if (isActionMenuOpen) {
    return;
  }
  scheduleActionMenuOpen();
}

function handleActionMenuPointerLeave() {
  cancelActionMenuHoverTimer();
  closeActionMenu({ immediate: true });
}

function handleActionToggleClick() {
  if (isActionMenuOpen) {
    closeActionMenu({ immediate: true });
    return;
  }

  cancelActionMenuHoverTimer();
  if (activeActionButton) {
    setCurrentAction(activeActionButton.dataset.action || currentAction, activeActionButton, { preserveTool: true });
  }
}

function handleActionToggleKeyDown(event) {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    if (isActionMenuOpen) {
      closeActionMenu({ immediate: true });
    } else {
      cancelActionMenuHoverTimer();
      openActionMenu();
    }
  } else if (event.key === "Escape") {
    event.preventDefault();
    closeActionMenu({ immediate: true });
    if (actionToggle) {
      actionToggle.blur();
    }
  }
}

function scheduleActionMenuOpen() {
  cancelActionMenuHoverTimer();
  actionMenuHoverTimer = setTimeout(() => {
    openActionMenu();
  }, ACTION_MENU_HOVER_DELAY);
}

function cancelActionMenuHoverTimer() {
  if (actionMenuHoverTimer) {
    clearTimeout(actionMenuHoverTimer);
    actionMenuHoverTimer = null;
  }
}

function openActionMenu() {
  if (!actionDropdown) {
    return;
  }
  cancelActionMenuHoverTimer();
  if (isActionMenuOpen) {
    return;
  }
  actionDropdown.hidden = false;
  if (actionMenu) {
    actionMenu.classList.add("is-expanded");
  }
  if (actionToggle) {
    actionToggle.setAttribute("aria-expanded", "true");
  }
  isActionMenuOpen = true;
}

function closeActionMenu({ immediate = false } = {}) {
  if (!actionDropdown) {
    return;
  }

  cancelActionMenuHoverTimer();

  if (!isActionMenuOpen && actionDropdown.hidden) {
    return;
  }

  if (immediate) {
    actionDropdown.hidden = true;
  } else {
    actionDropdown.hidden = true;
  }

  if (actionMenu) {
    actionMenu.classList.remove("is-expanded");
  }
  if (actionToggle) {
    actionToggle.setAttribute("aria-expanded", "false");
  }
  isActionMenuOpen = false;
}

function updateActionToggleLabel() {
  if (!actionToggleLabel) {
    return;
  }

  const label = activeActionButton?.textContent?.trim() || currentAction.charAt(0).toUpperCase() + currentAction.slice(1);
  actionToggleLabel.textContent = label;
}

function setCurrentAction(actionId, button, options = {}) {
  const { preserveTool = false } = options;

  if (button && activeActionButton === button && currentAction === actionId) {
    if (actionId === "resize") {
      autoCycleResize = true;
    }
    return;
  }

  if (activeActionButton && activeActionButton !== button) {
    activeActionButton.setAttribute("aria-pressed", "false");
  }

  if (button) {
    button.setAttribute("aria-pressed", "true");
    activeActionButton = button;
  } else {
    activeActionButton = null;
  }

  currentAction = actionId;

  if (currentAction === "resize") {
    autoCycleResize = true;
    const activeIndex = activeSizeButton ? sizeButtons.indexOf(activeSizeButton) : sizeScaleValues.indexOf(selectedSizeScale);
    sizeCycleIndex = activeIndex >= 0 ? activeIndex : 0;
  } else {
    autoCycleResize = false;
  }

  if (!preserveTool) {
    clearCurrentTool();
  }

  updateActionPanels();
  updateActionToggleLabel();
}

function updateActionPanels() {
  if (resizePanel) {
    resizePanel.hidden = currentAction !== "resize";
  }
  if (colorPanel) {
    colorPanel.hidden = currentAction !== "color";
  }
}

function setSizeScale(scale, button, options = {}) {
  const { updateCycleIndex = true } = options;
  const numericScale = typeof scale === "number" ? scale : parseFloat(scale);
  selectedSizeScale = Number.isFinite(numericScale) && numericScale > 0 ? numericScale : 1;
  if (activeSizeButton) {
    activeSizeButton.classList.remove("is-active");
    activeSizeButton.setAttribute("aria-pressed", "false");
  }
  if (button) {
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");
    activeSizeButton = button;
  } else {
    activeSizeButton = null;
  }

  if (updateCycleIndex) {
    const buttonIndex = button ? sizeButtons.indexOf(button) : sizeScaleValues.indexOf(selectedSizeScale);
    if (buttonIndex >= 0) {
      sizeCycleIndex = buttonIndex;
    }
  }
}

function setSelectedColor(color, button) {
  const resolvedColor = color || selectedColor || "#f97316";
  selectedColor = resolvedColor;
  if (activeColorButton) {
    activeColorButton.classList.remove("is-active");
    activeColorButton.setAttribute("aria-pressed", "false");
  }
  if (button) {
    button.classList.add("is-active");
    button.setAttribute("aria-pressed", "true");
    activeColorButton = button;
  }
}

function renderPreview(tool) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 32 32");
  svg.setAttribute("width", "32");
  svg.setAttribute("height", "32");

  const center = { x: 16, y: 16 };

  switch (tool.type) {
    case "circle": {
      const node = document.createElementNS(SVG_NS, "circle");
      node.setAttribute("cx", center.x);
      node.setAttribute("cy", center.y);
      node.setAttribute("r", tool.radius * 1.6);
      node.setAttribute("fill", tool.color || "currentColor");
      if (tool.stroke) node.setAttribute("stroke", tool.stroke);
      node.setAttribute("stroke-width", 1.6);
      svg.appendChild(node);
      break;
    }
    case "triangle": {
      const size = (tool.size || 8) * 1.3;
      const points = [
        `${center.x},${center.y - size / 1.5}`,
        `${center.x - size / 1.1},${center.y + size / 2}`,
        `${center.x + size / 1.1},${center.y + size / 2}`
      ].join(" ");
      const node = document.createElementNS(SVG_NS, "polygon");
      node.setAttribute("points", points);
      node.setAttribute("fill", tool.color || "currentColor");
      svg.appendChild(node);
      break;
    }
    case "pentagon": {
      const radius = (tool.size || 7) * 2;
      const points = getRegularPolygonPoints(center, radius, 5);
      const node = document.createElementNS(SVG_NS, "polygon");
      node.setAttribute("points", formatPoints(points));
      node.setAttribute("fill", tool.color || "currentColor");
      node.setAttribute("stroke", tool.stroke || "none");
      svg.appendChild(node);

      if (tool.inscription) {
        const text = document.createElementNS(SVG_NS, "text");
        text.setAttribute("x", center.x);
        text.setAttribute("y", center.y + 1);
        text.setAttribute("text-anchor", "middle");
        text.setAttribute("dominant-baseline", "middle");
        text.setAttribute("font-size", ((tool.size || 7) * 1.1).toFixed(2));
        text.setAttribute("fill", tool.textColor || "#f8fafc");
        text.setAttribute("font-weight", "600");
        text.textContent = tool.inscription;
        svg.appendChild(text);
      }
      break;
    }
    case "rect": {
      const width = (tool.width || 6) * 2.8;
      const height = (tool.height || 6) * 0.6;
      const node = document.createElementNS(SVG_NS, "rect");
      node.setAttribute("x", center.x - width / 2);
      node.setAttribute("y", center.y - height / 2);
      node.setAttribute("width", width);
      node.setAttribute("height", height);
      node.setAttribute("fill", tool.color || "currentColor");
      svg.appendChild(node);
      break;
    }
    case "goal": {
      const width = 24;
      const height = 12;
      const leftX = center.x - width / 2;
      const rightX = center.x + width / 2;
      const bottomY = center.y + height / 2;
      const topY = center.y - height / 2;
      const path = document.createElementNS(SVG_NS, "path");
      const d = [
        `M ${leftX} ${bottomY}`,
        `L ${rightX} ${bottomY}`,
        `L ${rightX} ${topY}`,
        `M ${leftX} ${bottomY}`,
        `L ${leftX} ${topY}`
      ].join(" ");
      path.setAttribute("d", d);
      path.setAttribute("fill", "none");
      path.setAttribute("stroke", tool.stroke || "currentColor");
      path.setAttribute("stroke-width", 2);
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("stroke-linecap", "round");
      svg.appendChild(path);
      break;
    }
    case "arrow": {
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", 6);
      line.setAttribute("y1", 24);
      line.setAttribute("x2", 26);
      line.setAttribute("y2", 8);
      line.setAttribute("stroke", tool.color || "currentColor");
      line.setAttribute("stroke-width", tool.width || 2);
      line.setAttribute("stroke-linecap", "round");
      if (tool.style === "dashed") {
        line.setAttribute("stroke-dasharray", "4 4");
      }
      if (tool.style === "double") {
        line.setAttribute("marker-start", "url(#arrowhead-preview-start)");
      }
      line.setAttribute("marker-end", "url(#arrowhead-preview-end)");
      svg.appendChild(createPreviewMarkers());
      svg.appendChild(line);
      break;
    }
    default: {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", center.x);
      circle.setAttribute("cy", center.y);
      circle.setAttribute("r", 8);
      circle.setAttribute("fill", "currentColor");
      svg.appendChild(circle);
    }
  }

  return svg;
}

function createPreviewMarkers() {
  const defs = document.createElementNS(SVG_NS, "defs");

  const endMarker = document.createElementNS(SVG_NS, "marker");
  endMarker.setAttribute("id", "arrowhead-preview-end");
  endMarker.setAttribute("markerWidth", "6");
  endMarker.setAttribute("markerHeight", "6");
  endMarker.setAttribute("refX", "5");
  endMarker.setAttribute("refY", "3");
  endMarker.setAttribute("orient", "auto");
  const endPath = document.createElementNS(SVG_NS, "path");
  endPath.setAttribute("d", "M0,0 L6,3 L0,6 z");
  endPath.setAttribute("fill", "currentColor");
  endMarker.appendChild(endPath);

  const startMarker = document.createElementNS(SVG_NS, "marker");
  startMarker.setAttribute("id", "arrowhead-preview-start");
  startMarker.setAttribute("markerWidth", "6");
  startMarker.setAttribute("markerHeight", "6");
  startMarker.setAttribute("refX", "1");
  startMarker.setAttribute("refY", "3");
  startMarker.setAttribute("orient", "auto");
  const startPath = document.createElementNS(SVG_NS, "path");
  startPath.setAttribute("d", "M6,0 L0,3 L6,6 z");
  startPath.setAttribute("fill", "currentColor");
  startMarker.appendChild(startPath);

  defs.appendChild(startMarker);
  defs.appendChild(endMarker);
  return defs;
}

function setupPitchInteraction() {
  pitch.addEventListener("pointerdown", handlePitchPointerDown);
  pitch.addEventListener("pointermove", handlePitchPointerMove);
  pitch.addEventListener("pointerup", handlePitchPointerUp);
  pitch.addEventListener("pointerleave", handlePitchPointerLeave);
  pitch.addEventListener("pointercancel", handlePitchPointerCancel);
}

function handlePitchPointerDown(event) {
  const drillItem = event.target.closest(".drill-item");
  if (drillItem) {
    handleDrillItemPointerDown(event, drillItem);
    return;
  }

  if (!currentTool) {
    return;
  }

  const point = getSVGPoint(event);

  if (currentTool.type === "arrow") {
    startArrowDraft(point, currentTool, event.pointerId);
  } else {
    const element = createShapeElement(point, currentTool);
    if (element) {
      pitch.appendChild(element);
    }
  }
}

function handlePitchPointerMove(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    const point = getSVGPoint(event);
    updateDrag(point);
    return;
  }

  if (!arrowDraft || arrowDraft.dataset.pointerId !== String(event.pointerId)) {
    return;
  }

  const point = getSVGPoint(event);
  updateArrowDraft(point);
}

function handlePitchPointerUp(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    finishDrag(event.pointerId);
  }

  finishArrowDraft(event);
}

function handlePitchPointerLeave(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    cancelDrag(event.pointerId);
  }

  cancelArrowDraft(event);
}

function handlePitchPointerCancel(event) {
  if (dragState && event.pointerId === dragState.pointerId) {
    cancelDrag(event.pointerId);
  }

  cancelArrowDraft(event);
}

function finishArrowDraft(event) {
  if (!arrowDraft) return;
  const point = getSVGPoint(event);
  updateArrowDraft(point);

  const length = calculateDistance(
    parseFloat(arrowDraft.getAttribute("x1")),
    parseFloat(arrowDraft.getAttribute("y1")),
    parseFloat(arrowDraft.getAttribute("x2")),
    parseFloat(arrowDraft.getAttribute("y2"))
  );

  if (length < 2) {
    arrowDraft.remove();
  } else {
    arrowDraft.removeAttribute("data-draft");
  }

  arrowDraft.removeAttribute("data-pointer-id");

  arrowDraft = null;
  releasePointerCaptureSafe(event.pointerId);
}

function cancelArrowDraft(event) {
  if (!arrowDraft) return;
  const pointerId = event?.pointerId ?? (arrowDraft.dataset.pointerId ? Number(arrowDraft.dataset.pointerId) : undefined);
  arrowDraft.remove();
  arrowDraft = null;
  if (typeof pointerId === "number") {
    releasePointerCaptureSafe(pointerId);
  }
}

function handleDrillItemPointerDown(event, item) {
  if (item.dataset.draft === "true") {
    return;
  }

  let handled = false;

  switch (currentAction) {
    case "move":
      startDrag(event, item);
      handled = true;
      break;
    case "remove":
      item.remove();
      handled = true;
      break;
    case "resize":
      applySizeToItem(item, getResizeScaleForApply());
      handled = true;
      break;
    case "color":
      applyColorToItem(item, selectedColor);
      handled = true;
      break;
    default:
      break;
  }

  if (handled) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function startDrag(event, item) {
  const type = item.dataset.type || item.tagName.toLowerCase();
  const point = getSVGPoint(event);
  dragState = {
    item,
    pointerId: event.pointerId,
    type,
    initialPointer: point,
    original: captureOriginalAttributes(item, type)
  };

  if (typeof pitch.setPointerCapture === "function") {
    pitch.setPointerCapture(event.pointerId);
  }
}

function updateDrag(point) {
  if (!dragState) return;
  const dx = point.x - dragState.initialPointer.x;
  const dy = point.y - dragState.initialPointer.y;
  const { item, type, original } = dragState;

  switch (type) {
    case "circle": {
      const newCx = original.cx + dx;
      const newCy = original.cy + dy;
      item.setAttribute("cx", newCx.toFixed(2));
      item.setAttribute("cy", newCy.toFixed(2));
      break;
    }
    case "triangle": {
      const translated = original.points.map((pt) => ({
        x: pt.x + dx,
        y: pt.y + dy
      }));
      item.setAttribute("points", formatPoints(translated));
      break;
    }
    case "rect": {
      const newX = original.x + dx;
      const newY = original.y + dy;
      item.setAttribute("x", newX.toFixed(2));
      item.setAttribute("y", newY.toFixed(2));
      break;
    }
    case "goal": {
      const width = original.width;
      const height = original.height;
      const newCenter = {
        x: original.centerX + dx,
        y: original.centerY + dy
      };
      setGoalGeometry(item, newCenter, width, height);
      break;
    }
    case "pentagon": {
      const polygon = item.querySelector("polygon");
      if (polygon) {
        const basePoints = original.points && original.points.length ? original.points : parsePointsAttribute(polygon.getAttribute("points"));
        const translated = basePoints.map((pt) => ({
          x: pt.x + dx,
          y: pt.y + dy
        }));
        polygon.setAttribute("points", formatPoints(translated));
      }
      const label = item.querySelector("text");
      if (label) {
        const baseX = original.textX ?? parseFloat(label.getAttribute("x") || "0");
        const baseY = original.textY ?? parseFloat(label.getAttribute("y") || "0");
        label.setAttribute("x", (baseX + dx).toFixed(2));
        label.setAttribute("y", (baseY + dy).toFixed(2));
      }
      item.dataset.centerX = (original.centerX + dx).toFixed(2);
      item.dataset.centerY = (original.centerY + dy).toFixed(2);
      break;
    }
    case "arrow": {
      item.setAttribute("x1", (original.x1 + dx).toFixed(2));
      item.setAttribute("y1", (original.y1 + dy).toFixed(2));
      item.setAttribute("x2", (original.x2 + dx).toFixed(2));
      item.setAttribute("y2", (original.y2 + dy).toFixed(2));
      break;
    }
    default: {
      if (item.hasAttribute("cx") && item.hasAttribute("cy")) {
        const newCx = original.cx + dx;
        const newCy = original.cy + dy;
        item.setAttribute("cx", newCx.toFixed(2));
        item.setAttribute("cy", newCy.toFixed(2));
      } else if (item.hasAttribute("x") && item.hasAttribute("y")) {
        const newX = original.x + dx;
        const newY = original.y + dy;
        item.setAttribute("x", newX.toFixed(2));
        item.setAttribute("y", newY.toFixed(2));
      }
    }
  }
}

function finishDrag(pointerId) {
  if (!dragState || dragState.pointerId !== pointerId) {
    return;
  }

  dragState = null;
  releasePointerCaptureSafe(pointerId);
}

function clearCurrentTool() {
  if (activeButton) {
    activeButton.setAttribute("aria-pressed", "false");
    activeButton = null;
  }
  currentTool = null;
}

function getResizeScaleForApply() {
  if (!sizeScaleValues.length) {
    return selectedSizeScale;
  }

  if (!autoCycleResize) {
    return selectedSizeScale;
  }

  sizeCycleIndex = (sizeCycleIndex + 1) % sizeScaleValues.length;
  const button = sizeButtons[sizeCycleIndex] || null;
  const scale = sizeScaleValues[sizeCycleIndex];
  setSizeScale(scale, button, { updateCycleIndex: false });
  selectedSizeScale = scale;
  return scale;
}

function cancelDrag(pointerId) {
  if (!dragState || dragState.pointerId !== pointerId) {
    return;
  }

  dragState = null;
  releasePointerCaptureSafe(pointerId);
}

function captureOriginalAttributes(item, type) {
  switch (type) {
    case "circle":
      return {
        cx: parseFloat(item.getAttribute("cx")),
        cy: parseFloat(item.getAttribute("cy"))
      };
    case "triangle":
      return {
        points: parsePointsAttribute(item.getAttribute("points"))
      };
    case "rect":
      return {
        x: parseFloat(item.getAttribute("x")),
        y: parseFloat(item.getAttribute("y"))
      };
    case "goal":
      return {
        centerX: parseFloat(item.dataset.centerX || "0"),
        centerY: parseFloat(item.dataset.centerY || "0"),
        width: parseFloat(item.dataset.width || item.dataset.baseWidth || "0"),
        height: parseFloat(item.dataset.height || item.dataset.baseHeight || "0")
      };
    case "pentagon": {
      const polygon = item.querySelector("polygon");
      const label = item.querySelector("text");
      return {
        centerX: parseFloat(item.dataset.centerX || "0"),
        centerY: parseFloat(item.dataset.centerY || "0"),
        points: polygon ? parsePointsAttribute(polygon.getAttribute("points")) : [],
        textX: label ? parseFloat(label.getAttribute("x") || "0") : null,
        textY: label ? parseFloat(label.getAttribute("y") || "0") : null
      };
    }
    case "arrow":
      return {
        x1: parseFloat(item.getAttribute("x1")),
        y1: parseFloat(item.getAttribute("y1")),
        x2: parseFloat(item.getAttribute("x2")),
        y2: parseFloat(item.getAttribute("y2"))
      };
    default:
      return {
        cx: parseFloat(item.getAttribute("cx") || "0"),
        cy: parseFloat(item.getAttribute("cy") || "0"),
        x: parseFloat(item.getAttribute("x") || "0"),
        y: parseFloat(item.getAttribute("y") || "0")
      };
  }
}

function parsePointsAttribute(attribute) {
  if (!attribute) return [];
  return attribute
    .split(/\s+/)
    .filter(Boolean)
    .map((pair) => {
      const [x, y] = pair.split(",").map(Number);
      return { x, y };
    });
}

function formatPoints(points) {
  return points.map((pt) => `${pt.x.toFixed(2)},${pt.y.toFixed(2)}`).join(" ");
}

function getRegularPolygonPoints(center, radius, sides, rotationOffset = -Math.PI / 2) {
  const safeSides = Math.max(3, Math.floor(sides));
  const angleStep = (Math.PI * 2) / safeSides;
  const startAngle = rotationOffset;
  const points = [];
  for (let index = 0; index < safeSides; index += 1) {
    const angle = startAngle + angleStep * index;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle)
    });
  }
  return points;
}

function startArrowDraft(point, tool, pointerId) {
  const line = createArrowElement(point, point, tool);
  line.dataset.draft = "true";
  line.dataset.pointerId = String(pointerId);
  arrowDraft = line;
  pitch.appendChild(line);
  if (typeof pitch.setPointerCapture === "function") {
    pitch.setPointerCapture(pointerId);
  }
}

function updateArrowDraft(point) {
  if (!arrowDraft) return;
  arrowDraft.setAttribute("x2", point.x.toFixed(2));
  arrowDraft.setAttribute("y2", point.y.toFixed(2));
}

function createShapeElement(point, tool) {
  switch (tool.type) {
    case "circle":
      return createCircle(point, tool);
    case "triangle":
      return createTriangle(point, tool);
    case "rect":
      return createRect(point, tool);
    case "goal":
      return createGoal(point, tool);
    case "pentagon":
      return createPentagon(point, tool);
    default:
      return createCircle(point, tool);
  }
}

function createCircle(point, tool) {
  const node = document.createElementNS(SVG_NS, "circle");
  node.classList.add("drill-item", "drill-circle");
  const radius = tool.radius || 4;
  node.setAttribute("cx", point.x.toFixed(2));
  node.setAttribute("cy", point.y.toFixed(2));
  node.setAttribute("r", radius.toString());
  node.setAttribute("fill", tool.color || "#f97316");
  if (tool.stroke) {
    node.setAttribute("stroke", tool.stroke);
    node.setAttribute("stroke-width", tool.strokeWidth || 0.8);
  }
  node.dataset.type = "circle";
  node.dataset.baseRadius = radius.toString();
  node.dataset.scale = "1";
  return node;
}

function createTriangle(point, tool) {
  const size = tool.size || 8;
  const points = [
    `${(point.x).toFixed(2)},${(point.y - size).toFixed(2)}`,
    `${(point.x - size * 0.85).toFixed(2)},${(point.y + size * 0.75).toFixed(2)}`,
    `${(point.x + size * 0.85).toFixed(2)},${(point.y + size * 0.75).toFixed(2)}`
  ].join(" ");

  const node = document.createElementNS(SVG_NS, "polygon");
  node.classList.add("drill-item", "drill-triangle");
  node.setAttribute("points", points);
  node.setAttribute("fill", tool.color || "#f97316");
  node.dataset.type = "triangle";
  node.dataset.baseSize = size.toString();
  node.dataset.scale = "1";
  return node;
}

function createPentagon(point, tool) {
  const size = tool.size || 7;
  const group = document.createElementNS(SVG_NS, "g");
  group.classList.add("drill-item", "drill-pentagon");
  group.dataset.type = "pentagon";
  group.dataset.baseSize = size.toString();
  group.dataset.scale = "1";
  group.dataset.centerX = point.x.toFixed(2);
  group.dataset.centerY = point.y.toFixed(2);

  const polygon = document.createElementNS(SVG_NS, "polygon");
  const polygonPoints = getRegularPolygonPoints(point, size, 5);
  polygon.setAttribute("points", formatPoints(polygonPoints));
  polygon.setAttribute("fill", tool.color || "#111827");
  polygon.setAttribute("stroke", tool.stroke || "none");
  group.appendChild(polygon);

  if (tool.inscription) {
    const text = document.createElementNS(SVG_NS, "text");
    const baseFontSize = tool.textSize || size * 0.85;
    text.classList.add("drill-label");
    text.setAttribute("x", point.x.toFixed(2));
    text.setAttribute("y", point.y.toFixed(2));
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-size", baseFontSize.toFixed(2));
    text.setAttribute("fill", tool.textColor || "#f8fafc");
    text.setAttribute("font-weight", "600");
    text.textContent = tool.inscription;
    text.dataset.baseFontSize = baseFontSize.toString();
    group.appendChild(text);
  }

  return group;
}

function createRect(point, tool) {
  const width = tool.width || 8;
  const height = tool.height || 16;
  const cornerRadius = tool.rx || width / 4;
  const node = document.createElementNS(SVG_NS, "rect");
  node.classList.add("drill-item", "drill-rect");
  node.setAttribute("x", (point.x - width / 2).toFixed(2));
  node.setAttribute("y", (point.y - height / 2).toFixed(2));
  node.setAttribute("width", width.toString());
  node.setAttribute("height", height.toString());
  node.setAttribute("rx", cornerRadius.toString());
  node.setAttribute("fill", tool.color || "#4ade80");
  node.dataset.type = "rect";
  node.dataset.baseWidth = width.toString();
  node.dataset.baseHeight = height.toString();
  node.dataset.baseRx = cornerRadius.toString();
  node.dataset.scale = "1";
  return node;
}

function setGoalGeometry(node, center, width, height) {
  const leftX = center.x - width / 2;
  const rightX = center.x + width / 2;
  const topY = center.y - height / 2;
  const bottomY = center.y + height / 2;
  const d = [
    `M ${leftX.toFixed(2)} ${bottomY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${bottomY.toFixed(2)}`,
    `L ${rightX.toFixed(2)} ${topY.toFixed(2)}`,
    `M ${leftX.toFixed(2)} ${bottomY.toFixed(2)}`,
    `L ${leftX.toFixed(2)} ${topY.toFixed(2)}`
  ].join(" ");
  node.setAttribute("d", d);
  node.dataset.centerX = center.x.toFixed(2);
  node.dataset.centerY = center.y.toFixed(2);
  node.dataset.width = width.toFixed(2);
  node.dataset.height = height.toFixed(2);
}

function createGoal(point, tool) {
  const width = tool.width || 12;
  const height = tool.height || 6;
  const node = document.createElementNS(SVG_NS, "path");
  node.classList.add("drill-item", "drill-goal");
  node.setAttribute("fill", "none");
  node.setAttribute("stroke", tool.stroke || "#e5e7eb");
  node.setAttribute("stroke-width", tool.strokeWidth || 1.5);
  node.setAttribute("stroke-linejoin", "round");
  node.setAttribute("stroke-linecap", "round");
  setGoalGeometry(node, point, width, height);
  node.dataset.type = "goal";
  node.dataset.baseWidth = width.toString();
  node.dataset.baseHeight = height.toString();
  node.dataset.scale = "1";
  return node;
}

function createArrowElement(start, end, tool) {
  const line = document.createElementNS(SVG_NS, "line");
  line.classList.add("drill-item", "drill-arrow");
  line.setAttribute("x1", start.x.toFixed(2));
  line.setAttribute("y1", start.y.toFixed(2));
  line.setAttribute("x2", end.x.toFixed(2));
  line.setAttribute("y2", end.y.toFixed(2));
  line.setAttribute("stroke", tool.color || "#facc15");
  line.setAttribute("stroke-width", tool.width || 2.5);
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("fill", "none");
  if (tool.style === "dashed") {
    line.setAttribute("stroke-dasharray", "6 6");
  }
  line.setAttribute("marker-end", "url(#arrowhead)");
  if (tool.style === "double") {
    line.setAttribute("marker-start", "url(#arrowhead-double)");
  }
  line.dataset.type = "arrow";
  line.dataset.baseStrokeWidth = (tool.width || 2.5).toString();
  line.dataset.scale = "1";
  line.style.color = tool.color || "#facc15";
  return line;
}

function applySizeToItem(item, scale) {
  if (!item || item.dataset.draft === "true") return;
  const type = item.dataset.type || item.tagName.toLowerCase();
  const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;
  item.dataset.scale = safeScale.toString();

  switch (type) {
    case "circle": {
      const baseRadius = parseFloat(item.dataset.baseRadius || item.getAttribute("r") || "0");
      const radius = baseRadius * safeScale;
      item.setAttribute("r", radius.toFixed(2));
      break;
    }
    case "triangle": {
      const baseSize = parseFloat(item.dataset.baseSize || "0");
      if (!baseSize) break;
      const center = getPolygonCentroid(item);
      const size = baseSize * safeScale;
      const newPoints = [
        { x: center.x, y: center.y - size },
        { x: center.x - size * 0.85, y: center.y + size * 0.75 },
        { x: center.x + size * 0.85, y: center.y + size * 0.75 }
      ];
      item.setAttribute("points", formatPoints(newPoints));
      break;
    }
    case "rect": {
      const baseWidth = parseFloat(item.dataset.baseWidth || item.getAttribute("width") || "0");
      const baseHeight = parseFloat(item.dataset.baseHeight || item.getAttribute("height") || "0");
      const currentWidth = parseFloat(item.getAttribute("width") || "0");
      const currentHeight = parseFloat(item.getAttribute("height") || "0");
      const centerX = parseFloat(item.getAttribute("x") || "0") + currentWidth / 2;
      const centerY = parseFloat(item.getAttribute("y") || "0") + currentHeight / 2;
      const width = baseWidth * safeScale;
      const height = baseHeight * safeScale;
      item.setAttribute("width", width.toFixed(2));
      item.setAttribute("height", height.toFixed(2));
      item.setAttribute("x", (centerX - width / 2).toFixed(2));
      item.setAttribute("y", (centerY - height / 2).toFixed(2));
      if (type === "rect") {
        const baseRx = parseFloat(item.dataset.baseRx || item.getAttribute("rx") || "0");
        if (baseRx) {
          item.setAttribute("rx", (baseRx * safeScale).toFixed(2));
        }
      }
      break;
    }
    case "goal": {
      const baseWidth = parseFloat(item.dataset.baseWidth || item.dataset.width || "0");
      const baseHeight = parseFloat(item.dataset.baseHeight || item.dataset.height || "0");
      if (!baseWidth || !baseHeight) break;
      const center = {
        x: parseFloat(item.dataset.centerX || "0"),
        y: parseFloat(item.dataset.centerY || "0")
      };
      const width = baseWidth * safeScale;
      const height = baseHeight * safeScale;
      setGoalGeometry(item, center, width, height);
      break;
    }
    case "pentagon": {
      const baseSize = parseFloat(item.dataset.baseSize || "0");
      if (!baseSize) break;
      const center = {
        x: parseFloat(item.dataset.centerX || "0"),
        y: parseFloat(item.dataset.centerY || "0")
      };
      const polygon = item.querySelector("polygon");
      if (polygon) {
        const points = getRegularPolygonPoints(center, baseSize * safeScale, 5);
        polygon.setAttribute("points", formatPoints(points));
      }
      const label = item.querySelector("text");
      if (label) {
        const baseFontSize = parseFloat(label.dataset.baseFontSize || label.getAttribute("font-size") || "0");
        if (baseFontSize) {
          label.setAttribute("font-size", (baseFontSize * safeScale).toFixed(2));
        }
        label.setAttribute("x", center.x.toFixed(2));
        label.setAttribute("y", center.y.toFixed(2));
      }
      break;
    }
    case "arrow": {
      const baseWidth = parseFloat(item.dataset.baseStrokeWidth || item.getAttribute("stroke-width") || "2");
      const strokeWidth = baseWidth * safeScale;
      item.setAttribute("stroke-width", strokeWidth.toFixed(2));
      break;
    }
    default: {
      if (item.hasAttribute("r")) {
        const baseRadius = parseFloat(item.dataset.baseRadius || item.getAttribute("r") || "0");
        const radius = baseRadius * safeScale;
        item.setAttribute("r", radius.toFixed(2));
      }
    }
  }
}

function applyColorToItem(item, color) {
  if (!item || item.dataset.draft === "true" || !color) return;
  const type = item.dataset.type || item.tagName.toLowerCase();

  switch (type) {
    case "goal": {
      item.setAttribute("stroke", color);
      break;
    }
    case "arrow": {
      item.setAttribute("stroke", color);
      item.style.color = color;
      break;
    }
    case "rect":
    case "triangle":
    case "circle": {
      item.setAttribute("fill", color);
      break;
    }
    case "pentagon": {
      const polygon = item.querySelector("polygon");
      if (polygon) {
        polygon.setAttribute("fill", color);
      }
      break;
    }
    default: {
      if (item.tagName.toLowerCase() === "line") {
        item.setAttribute("stroke", color);
      } else {
        item.setAttribute("fill", color);
      }
    }
  }
}

function getPolygonCentroid(polygon) {
  const points = parsePointsAttribute(polygon.getAttribute("points"));
  if (!points.length) {
    return { x: 0, y: 0 };
  }

  const sum = points.reduce(
    (acc, point) => ({
      x: acc.x + point.x,
      y: acc.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return {
    x: sum.x / points.length,
    y: sum.y / points.length
  };
}

function getSVGPoint(event) {
  const point = pitch.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = pitch.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  return point.matrixTransform(ctm.inverse());
}

function calculateDistance(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function releasePointerCaptureSafe(pointerId) {
  if (typeof pitch.hasPointerCapture === "function" && pitch.hasPointerCapture(pointerId)) {
    pitch.releasePointerCapture(pointerId);
  }
}

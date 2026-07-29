export function createElement(tagName, options = {}) {
    const element = document.createElement(tagName);

    if (options.className !== undefined) element.className = options.className;
    if (options.text !== undefined) element.textContent = String(options.text);
    if (options.value !== undefined) element.value = String(options.value);
    if (options.type !== undefined) element.type = options.type;
    if (options.id !== undefined) element.id = options.id;
    if (options.min !== undefined) element.min = String(options.min);
    if (options.max !== undefined) element.max = String(options.max);
    if (options.step !== undefined) element.step = String(options.step);
    if (options.checked !== undefined) element.checked = options.checked;

    return element;
}

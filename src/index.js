export function h(type, props, ...children) {
  return {
    type,
    props,
    children: children.length > 1 ? children : children[0],
  }
}

export function createRoot(rootDom) {
  const nativeEvents = ['click']
  function creatDomElement(element) {
    const { type, props, children } = element
    const dom = document.createElement(type)
    dom.element = element
    if (Array.isArray(children)) {
      for (const child of children) {
        const childDom = creatDomElement(child)
        dom.appendChild(childDom)
      }
    } else {
      dom.textContent = children
    }
    return dom
  }
  function formatElement(element, parent = null) {
    element.parent = parent
    if (Array.isArray(element.children)) {
      for (const child of element.children) {
        formatElement(child, element)
      }
    }
  }
  function render(element) {
    formatElement(element)
    const dom = creatDomElement(element)
    rootDom.appendChild(dom)
  }
  function listenSyntheticEvent() {
    function captureListener(nativeEventName, nativeEvent) {
      const element = nativeEvent.target.element
      const listeners = []
      let current = element
      while (current) {
        const captureEventName =
          'on' +
          nativeEventName[0].toUpperCase() +
          nativeEventName.slice(1) +
          'Capture'
        const listener = current.props[captureEventName]
        if (listener) {
          listeners.push(listener)
        }
        current = current.parent
      }
      const _event = new SyntheticEvent(nativeEvent)
      for (let i = listeners.length - 1; i >= 0; i--) {
        if (_event.propagationStopped) {
          return
        }
        const listener = listeners[i]
        listener(_event)
      }
    }
    function bubbleListener(nativeEventName, nativeEvent) {
      const element = nativeEvent.target.element
      const listeners = []
      let current = element
      while (current) {
        const eventName =
          'on' + nativeEventName[0].toUpperCase() + nativeEventName.slice(1)
        const listener = current.props[eventName]
        if (listener) {
          listeners.push(listener)
        }
        current = current.parent
      }
      const _event = new SyntheticEvent(nativeEvent)
      for (let i = 0; i < listeners.length; i++) {
        if (_event.propagationStopped) {
          return
        }
        const listener = listeners[i]
        listener(_event)
      }
    }
    nativeEvents.forEach((nativeEventName) => {
      const wrapCaptureListener = captureListener.bind(null, nativeEventName)
      const wrapBubbleListenerListener = bubbleListener.bind(
        null,
        nativeEventName,
      )
      rootDom.addEventListener(nativeEventName, wrapCaptureListener, true)
      rootDom.addEventListener(nativeEventName, wrapBubbleListenerListener)
    })
  }
  listenSyntheticEvent()
  return {
    render,
  }
}

class SyntheticEvent {
  nativeEvent = null
  defaultPrevented = false
  propagationStopped = false
  constructor(nativeEvent) {
    this.nativeEvent = nativeEvent
  }
  preventDefault() {
    this.defaultPrevented = true
    this.nativeEvent.preventDefault()
  }
  stopPropagation() {
    this.propagationStopped = true
    this.nativeEvent.stopPropagation()
  }
}

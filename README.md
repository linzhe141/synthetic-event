# 从事件代理到 React 合成事件

[playground demo](https://linzhe141.github.io/synthetic-event/)

> 以下内容均以点击事件为例。

## 浏览器的事件传播机制

- 当我们点击一个元素时，事件会从捕获阶段开始向下传播。在这一阶段中，如果元素绑定了 `captureEventListener`，这些监听器会依次被触发。
- 到达目标元素后，由于事件冒泡机制，事件会再向上传播。如果这些元素绑定了 `eventListener`，这些监听器也会依次被触发。
- 如果我们希望阻止这种传播机制，可以在 `captureEventListener` 或 `eventListener` 中调用 `event.stopPropagation()`，以阻止事件在捕获或冒泡阶段的进一步传播。

## 事件代理

事件代理是基于事件冒泡机制的一种实现方式。我们可以在祖先元素上绑定 `eventListener`，当点击目标元素时，事件会冒泡到祖先元素并触发其绑定的监听器。

> 可通过 `event.target` 获取事件的目标元素（即被点击的最内层元素）。
> 如果希望访问处理事件的元素（本例中是容器），可使用 `event.currentTarget`。

## React 合成事件

> 我们的目标并不是完全复刻 React，而是学习其背后的设计思想，并且还需要对 react 实现有一定的了解。

React 使用“事件委托 + 自定义事件系统”实现了合成事件。基于前面的内容，我们可以实现一个类 React 的合成事件系统。

### renderer

在 classic 模式下的 Babel 会将 JSX 编译为如下形式，而 Vite 默认支持这种 Babel 转换规则，因此我们只需实现一个 `h` 函数来创建虚拟 DOM：

![Image](https://github.com/user-attachments/assets/107d4e91-6b9f-4fdb-84bb-393be9ad724f)

```js
export function h(type, props, ...children) {
  return {
    type,
    props,
    children: children.length > 1 ? children : children[0],
  }
}
```

根据 react API 的风格，我们实现一个 renderer 来渲染 vdom，提供一个 `createRoot` 函数。注意此时我们的 renderer 只是将 vdom 转换为真实 DOM，并未绑定任何事件。

```js
export function createRoot(rootDom) {
  // 只是根据vdom创建了dom，并没有绑定任何事件
  function creatDomElement(element) {
    const { type, children } = element
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

  // 模拟fiber
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

  return {
    render,
  }
}
```

示例：将 vdom 渲染为真实 DOM

```jsx
const elements = (
  <div
    onClick={() => console.log('parent onClick')}
    onClickCapture={() => console.log('parent onClickCapture')}
  >
    <div
      onClick={(e) => {
        e.stopPropagation()
        console.log('111 onClick')
      }}
      onClickCapture={(e) => {
        console.log('111 onClickCapture')
      }}
    >
      111
    </div>
    <div
      onClick={() => console.log('222 onClick')}
      onClickCapture={() => console.log('222 onClickCapture')}
    >
      222
    </div>
  </div>
)

const root = createRoot(document.getElementById('root'))
root.render(elements)
```

### 实现事件代理

我们已经实现了一个简化版本的 renderer。接下来是本文的重点——React 是如何实现合成事件的。

借助事件代理机制，我们可以将所有事件统一绑定在 `rootDom` 上。当点击目标元素时，事件会因冒泡而在 `rootDom` 上触发对应的监听器。React 正是采用了这种方式。

在渲染器中，我们在 `rootDom` 上添加两类原生事件监听（`listenSyntheticEvent`）：

- 捕获阶段监听器（captureListener）
- 冒泡阶段监听器（bubbleListener）

```diff
export function createRoot(rootDom) {
+ listenSyntheticEvent()
  return {
    render,
  }
}
```

在 rootDom 上绑定了捕获和冒泡这两类的原生事件，下面有一个比较奇怪的bind的使用方式：

```js
const wrapCaptureListener = captureListener.bind(null, nativeEventName)
```

其效果与下图一致，React 源码中大量使用了这种写法：

![Image](https://github.com/user-attachments/assets/4f31dc69-150e-4e32-9a78-fabee9a73163)

```js
function listenSyntheticEvent() {
  const nativeEvents = ['click']

  function captureListener(nativeEventName, nativeEvent) {
    const element = nativeEvent.target.element
    const listeners = []
    // 根据模拟的 Fiber 架构收集捕获监听器
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
    // 触发正确的react事件
    const _event = new SyntheticEvent(nativeEvent)
    // 因为是向上收集listeners，所以对应的捕获触发顺序就应该从尾开始
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
    // 根据模拟的 Fiber 架构收集冒泡监听器
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
    // 触发正确的react事件
    const _event = new SyntheticEvent(nativeEvent)
    // 因为是向上收集listeners，所以对应的冒泡触发顺序就应该从头开始
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
    // 在rootDom上绑定了捕获和冒泡这两类的原生事件
    rootDom.addEventListener(nativeEventName, wrapCaptureListener, true)
    rootDom.addEventListener(nativeEventName, wrapBubbleListenerListener)
  })
}
```

`SyntheticEvent` 是对原生事件的封装，核心目的是统一实现 `stopPropagation` 和 `preventDefault` 方法：

```js
class SyntheticEvent {
  nativeEvent = null
  defaultPrevented = false
  propagationStopped = false

  constructor(nativeEvent) {
    this.nativeEvent = nativeEvent
  }

  preventDefault() {
    this.defaultPrevented = true
    // 调用原生事件的preventDefault()
    this.nativeEvent.preventDefault()
  }

  stopPropagation() {
    this.propagationStopped = true
    // 调用原生事件的stopPropagation()
    this.nativeEvent.stopPropagation()
  }
}
```

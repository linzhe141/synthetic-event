# 从事件代理到 react 合成事件

> 本文都是拿点击事件举例

## 浏览器的事件传播机制

- 当我们点击一个元素时，浏览器会从捕获阶段向下传播，在向下传播的过程中，如果这些元素绑定了`captureEventListener`，那么就会依次触发这些`captureEventListener`
- 然后到达真正被点击的元素，由于事件冒泡的机制，又会向上传播，如果这些元素绑定了`eventListener`，那么就会依次触发这些`eventListener`
- 如果我们不想要这种机制，那么我们可以在一个`captureEventListener或eventListener`中执行`event.stopPropagation()`方法阻止捕获和冒泡阶段中当前事件的进一步传播

## 事件代理

事件代理就是根据事件的冒泡机制实现的。我们可以在祖先元素上绑定`eventListener`，当我们点击目标元素时，就会冒泡到祖先元素，并且这个祖先元素绑定了`eventListener`，因此就会触发。并且这还有个优势，就是我们不必为每个元素都绑定事件。

> 使用 event.target 来获取事件的目标元素（也就是最里面的元素）。
> 如果我们想访问处理这个事件的元素（在这个例子中是容器），我们可以使用 event.currentTarget。

## react 合成事件

> 我们的目标不是完全复刻 react，而是学习它背后的设计思想，并且需要对 react 实现有一定的了解。

react 就是采用了“事件委托 + 自定义事件系统”的方式实现了合成事件。根据上文介绍，我们可以实现一个类 react 的合成事件。

### renderer

在 classic 下的 babel，会对 jsx 编译成如下这样，并且我发现 vite 默认就支持这种 babel 规则的转换，所以我们只需要实现一个`h函数来创建虚拟dom`。

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

根据 react 的风格实现一个 renderer 来渲染 vdom，提供如下`createRoot`这个api。注意我们这个`renderer 只是把 vdom 创建成 dom`了，并没有绑定任何事件。

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

渲染 vdom 成真正的 dom

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

### 事件代理

上面我们实现了一个简易版本的渲染器，接下来才是本文的重点，也就是 react 是如何实现合成事件的。

根据事件代理，我们可以把所有的事件都注册到`rootDom`上，然后在点击目标元素，由于事件冒泡的机制就会在`rootDom`触发对应的`eventListener和captureEventListener`，的确 react 本身也就是这么实现的。

在渲染器中，我们会在`rootDom`添加两类事件(`listenSyntheticEvent`)

- captureListener
- bubbleListener

```diff
export function createRoot(rootDom) {
+ listenSyntheticEvent()
  return {
    render,
  }
}
```

在rootDom上绑定了捕获和冒泡这两类的原生事件，下面有一个比较奇怪的bind的使用方式。比如`const wrapCaptureListener = captureListener.bind(null, nativeEventName)`，但其实就是下面这种效果，react 源码有很多这个`bind`的使用

![Image](https://github.com/user-attachments/assets/4f31dc69-150e-4e32-9a78-fabee9a73163)

```js
// 事件代理
function listenSyntheticEvent() {
  const nativeEvents = ['click']
  function captureListener(nativeEventName, nativeEvent) {
    const element = nativeEvent.target.element
    const listeners = []
    // 收集captureListener，根据renderer中模拟的fiber
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
    // 收集bubbleListener 根据renderer中模拟的fiber
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

`SyntheticEvent`这个合成事件的目的就是包装了原生事件，实现`stopPropagation`和`preventDefault`

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

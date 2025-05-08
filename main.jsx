import { h, createRoot } from './src'

// vite默认支持 babel 的 /** @jsx h123 */ 规则，可能就是esbuid

/** @jsx h */
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

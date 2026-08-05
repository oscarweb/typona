import React, { useEffect, useRef } from 'react'

export default function Outline({ headings, activeIndex, onSelect }) {
  const itemRefs = useRef([])

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  if (!headings || headings.length === 0) {
    return <div className="sidebar-empty">Este documento no tiene encabezados</div>
  }

  return (
    <div>
      {headings.map((heading, index) => (
        <div
          key={index}
          ref={(el) => (itemRefs.current[index] = el)}
          className={`outline-item${index === activeIndex ? ' active' : ''}`}
          style={{ paddingLeft: 10 + (heading.level - 1) * 14 }}
          onClick={() => onSelect(index)}
          title={heading.text}
        >
          {heading.text}
        </div>
      ))}
    </div>
  )
}

"use client"

import { useState } from "react"
import { PhotoStage } from "@/components/shop/photo-stage"
import { ShopCover } from "@/components/shop/shop-cover"

export function ProductGallery({
    photos,
    type,
    title,
}: {
    photos: string[]
    type: string
    title: string
}) {
    const [index, setIndex] = useState(0)
    if (photos.length === 0) {
        return <ShopCover src={null} type={type} title={title} className="aspect-square w-full overflow-hidden rounded-2xl" />
    }
    return <PhotoStage photos={photos} active={index} onSelect={setIndex} />
}

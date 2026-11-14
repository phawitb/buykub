"use client";
import { RouteErrorState } from "@/components/RouteErrorState";
export default function LearnError({reset}:{error:Error & {digest?:string}; reset:()=>void}) { return <RouteErrorState reset={reset}/>; }

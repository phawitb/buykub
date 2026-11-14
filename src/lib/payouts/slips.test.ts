import { expect,it } from "vitest";
import { validateSlip } from "./slips";
it("accepts matching PNG/JPEG/WebP/PDF file signatures",()=>{
 for(const [type,header,extension] of [["image/png",[137,80,78,71,13,10,26,10],"png"],["image/jpeg",[255,216,255,224],"jpg"],["application/pdf",[37,80,68,70,45,49,46,55],"pdf"],["image/webp",[82,73,70,70,0,0,0,0,87,69,66,80],"webp"]] as const)expect(validateSlip(type,Uint8Array.from(header),100)).toBe(extension);
});
it("rejects disguised HTML, SVG, mismatched signatures, empty and large files",()=>{
 for(const [type,bytes,size] of [["image/png",[60,104,116,109,108],100],["image/svg+xml",[60,115,118,103],100],["application/pdf",[255,216,255],100],["image/png",[137,80,78,71,13,10,26,10],0],["image/png",[137,80,78,71,13,10,26,10],5242881]] as const) expect(()=>validateSlip(type,Uint8Array.from(bytes),size)).toThrow();
});

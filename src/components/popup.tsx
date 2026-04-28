import { Toast } from "even-toolkit/web";
import { useState } from "react"

export function Popup({ toastMessage, showToast } : {toastMessage: string, showToast: boolean}) {

    return (
    <>
        {
            showToast &&
            <Toast message={toastMessage} className="toast-anim absolute w-fit mx-auto text-center bottom-0 left-0 right-0"/>
        }
    </>
    )
}
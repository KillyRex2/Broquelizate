export const CartCounter = () => {
    return (
        <a href="/cart" className="relative inline-block">
            <span className="absolute -top-2 -right-2 flex justify-center items-center bg-yellow-600 text-black font-semibold text-xs rounded-full w-4 h-4">
                3
            </span>
            {/* <svg 
                xmlns="http://www.w3.org/2000/svg" 
                width="1.5rem" 
                height="1.5rem" 
                viewBox="0 0 24 24">
                <path fill="#fff"
                 d="M0 1h4.764l.545 2h18.078l-3.666 11H7.78l-.5 2H22v2H4.72l1.246-4.989L3.236 3H0zm4 20a2 2 0 1 1 4 0a2 2 0 0 1-4 0m14 0a2 2 0 1 1 4 0a2 2 0 0 1-4 0">
                </path>
            </svg> */}

            <svg xmlns="http://www.w3.org/2000/svg" width="1.5rem" height="1.5rem" viewBox="0 0 24 24"><path fill="currentColor" d="M0 1h4.764l.545 2h18.078l-3.666 11H7.78l-.5 2H22v2H4.72l1.246-4.989L3.236 3H0zm7.764 11h10.515l2.334-7H5.855zM4 21a2 2 0 1 1 4 0a2 2 0 0 1-4 0m14 0a2 2 0 1 1 4 0a2 2 0 0 1-4 0"></path></svg>
        </a>
    )
}
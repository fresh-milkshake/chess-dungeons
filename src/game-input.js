// Game surfaces own pointer gestures; native menus and text selection interrupt them.
document.addEventListener('contextmenu',event=>event.preventDefault());
document.addEventListener('selectstart',event=>{
 if(!event.target.closest?.('input,textarea,[contenteditable="true"]'))event.preventDefault();
});

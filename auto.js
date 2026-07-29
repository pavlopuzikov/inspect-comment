// Script-tag entry point. Loading this file mounts the inspector immediately:
//
//   <script type="module" src="/auto.js"></script>
//
// Safe to put in <head> without defer; the core waits for document.body.
import { mount } from "./src/inspect-comment.js";

mount();

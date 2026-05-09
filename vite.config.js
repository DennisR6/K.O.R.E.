import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
	plugins: [react()],
	build: {
		rollupOptions: {
			input: {
				game: resolve(__dirname, "index.html"),
				// editor: resolve(__dirname, "src-website.html"),
			},
		},
	},
});

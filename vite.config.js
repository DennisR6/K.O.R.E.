import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
	server: {
		allowedHosts: ["lupricht.net"],
		proxy: {
			"/api": {
				target: 'https://lupricht.net',
				changeOrigin: true,
				secure: true
			}
		}
	},
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

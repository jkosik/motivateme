package main

import (
	"log"
	"net/http"
	"os"
)

func main() {
	// Determine static file directory (Docker: ./dist, local: ../dist)
	distDir := os.Getenv("DIST_DIR")
	if distDir == "" {
		distDir = "../dist" // Default for local development
		if _, err := os.Stat("./dist"); err == nil {
			distDir = "./dist" // Docker/production path
		}
	}

	// Serve built files
	fs := http.FileServer(http.Dir(distDir))
	http.Handle("/", fs)

	// Get port from environment or default to 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	addr := ":" + port

	log.Printf("➡️  Serving from %s on http://0.0.0.0%s ...", distDir, addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

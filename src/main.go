package main

import (
	"log"
	"net/http"
)

func main() {
	// Serve built files from ../dist
	fs := http.FileServer(http.Dir("../dist"))
	http.Handle("/", fs)

	addr := ":8080"
	log.Printf("➡️  Serving on http://localhost%s ...", addr)
	if err := http.ListenAndServe(addr, nil); err != nil {
		log.Fatal(err)
	}
}

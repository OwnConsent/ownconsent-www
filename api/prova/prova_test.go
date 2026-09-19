package prova

import "testing"

// TestSommaFallisce asserisce un risultato falso di proposito: 2 + 3 non fa 6.
// Serve a vedere ci rosso nel passo go test, non in go build.
func TestSommaFallisce(t *testing.T) {
	if got := Somma(2, 3); got != 6 {
		t.Fatalf("Somma(2, 3) = %d, l'asserzione falsa di questa prova attende 6", got)
	}
}

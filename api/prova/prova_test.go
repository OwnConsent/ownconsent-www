package prova

import "testing"

func TestSomma(t *testing.T) {
	if got := Somma(2, 3); got != 5 {
		t.Fatalf("Somma(2, 3) = %d, atteso 5", got)
	}
}

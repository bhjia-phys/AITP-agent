// Synthetic screening code.
#include <vector>

namespace demo {

// Head correction, eq. (12) of the note.
double head_correction(double q, double eps) {
  return eps / (q * q + 1.0);
}

class Screening {
 public:
  explicit Screening(int n) : n_(n) {}
  double tail(double omega) const { return 1.0 / (omega * omega + n_); }

 private:
  int n_;
};

}  // namespace demo

! Synthetic kernel.
module kernel
contains
  subroutine apply_kernel(n, x)
    integer, intent(in) :: n
    real(8), intent(inout) :: x(n)
    x = 2.0d0 * x
  end subroutine apply_kernel
end module kernel

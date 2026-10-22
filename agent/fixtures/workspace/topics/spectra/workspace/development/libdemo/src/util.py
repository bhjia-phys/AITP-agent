"""Synthetic helpers."""


def damped_update(old, new, alpha):
    return (1 - alpha) * old + alpha * new


class Mixer:
    def __init__(self, alpha):
        self.alpha = alpha

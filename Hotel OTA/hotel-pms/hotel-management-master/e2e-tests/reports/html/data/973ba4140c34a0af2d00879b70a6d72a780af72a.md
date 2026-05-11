# Page snapshot

```yaml
- generic [ref=e4]:
  - generic [ref=e5]:
    - img [ref=e7]
    - heading "Sign in to your account" [level=2] [ref=e11]
    - paragraph [ref=e12]:
      - text: Or
      - link "create a new account" [ref=e13] [cursor=pointer]:
        - /url: /register
  - generic [ref=e15]:
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: Email address
        - textbox "Enter your email" [ref=e19]
      - generic [ref=e20]:
        - generic [ref=e21]:
          - generic [ref=e22]: Password
          - textbox "Enter your password" [ref=e23]
        - button [ref=e24] [cursor=pointer]:
          - img [ref=e25] [cursor=pointer]
      - button "Sign in" [ref=e28] [cursor=pointer]
    - generic [ref=e29]:
      - generic [ref=e34]: Demo Accounts
      - generic [ref=e35]:
        - paragraph [ref=e36]:
          - strong [ref=e37]: "Admin:"
          - text: admin@hotel.com / admin123
        - paragraph [ref=e38]:
          - strong [ref=e39]: "Staff:"
          - text: staff@hotel.com / staff123
        - paragraph [ref=e40]:
          - strong [ref=e41]: "Guest:"
          - text: john@example.com / guest123
```
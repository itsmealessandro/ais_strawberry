# Example Walkthrough: WS_Lib

The paper introduces a toy web service (WS_Lib) to illustrate the StrawBerry pipeline.

## Operations

- Connect(user, password) -> cart, userID, errmsg
- Disconnect(userID) -> regularResponse, errmsg
- Search(authors, isbn, keywords, title) -> bookDetailsList, errmsg
- AddToCart(itemId, itemList, cart) -> cart, errmsg
- MakeAnOrder(cart) -> cart, errmsg

Session data are explicit in I/O: userID, cart, bookDetailsList, itemList.

## Dependency discovery

From syntactic type matches, StrawBerry derives candidate dependencies, for example:

- Search.bookDetailsList -> AddToCart.itemList
- Connect.cart -> AddToCart.cart
- AddToCart.cart -> MakeAnOrder.cart

Many string-to-string matches are also produced; these are filtered using heuristics and later testing.

## Heuristics impact

- Complex type dependencies (e.g., BookCart, BookDetailsList) are marked as certain.
- Same-name + same-type dependencies (e.g., Connect.userID -> Disconnect.userID) become certain.
- Error outputs (errmsg) are removed.

## Saturation

The Env node is added to allow direct client-provided inputs. This creates dependencies such as:

- Env -> Search.authors
- Env -> AddToCart.itemId

## Testing refinement

Positive tests remove false dependencies. Negative tests confirm uncertain ones. Remaining uncertain dependencies are conservatively dropped.

## Behavior protocol

The final automaton captures valid interaction sequences, for example:

- A client can Search, then AddToCart using Search.bookDetailsList.
- AddToCart can be chained because it outputs cart, enabling further AddToCart or MakeAnOrder.
